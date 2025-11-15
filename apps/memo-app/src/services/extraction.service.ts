import { Mistral } from "@mistralai/mistralai";
import { FieldType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { formService } from "./form.service";

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

interface ExtractionResult {
  data: Record<string, any>;
  missingFields: string[];
  confidence: number;
}

export class ExtractionService {
  /**
   * Extract structured data from memo content based on form schema
   */
  async extractDataFromMemo(
    memoId: string,
    formId: string,
    userId: string,
  ): Promise<ExtractionResult> {
    // Get memo content
    const memo = await prisma.memo.findUnique({
      where: { id: memoId },
      include: {
        memoFiles: {
          include: {
            file: true,
          },
        },
      },
    });

    if (!memo) {
      throw new Error("Memo not found");
    }

    // Get form schema
    const form = await formService.getForm(formId, userId);
    if (!form) {
      throw new Error("Form not found");
    }

    // Build JSON schema for the form
    const _schema = this.buildJsonSchema(form);

    // Create extraction prompt
    const prompt = this.buildExtractionPrompt(memo.content, form);

    // Call Mistral AI for extraction
    const completion = await mistral.chat.complete({
      model: "mistral-large-latest",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      responseFormat: {
        type: "json_object",
      },
    });

    const responseContent = completion.choices?.[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from AI");
    }

    // Parse AI response - handle both string and array responses
    const contentString =
      typeof responseContent === "string"
        ? responseContent
        : JSON.stringify(responseContent);
    const extractedData = JSON.parse(contentString);

    // Validate and identify missing required fields
    const missingFields = this.identifyMissingFields(form, extractedData);

    // Calculate confidence based on completeness
    const totalRequiredFields = form.fields.filter((f) => f.required).length;
    const foundRequiredFields = totalRequiredFields - missingFields.length;
    const confidence =
      totalRequiredFields > 0 ? foundRequiredFields / totalRequiredFields : 1;

    // Save the extracted data
    await formService.saveMemoFormData(
      memoId,
      formId,
      userId,
      extractedData,
      missingFields,
    );

    return {
      data: extractedData,
      missingFields,
      confidence,
    };
  }

  /**
   * Build JSON schema from form definition
   */
  private buildJsonSchema(form: any): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const field of form.fields) {
      properties[field.name] = {
        type: this.mapFieldTypeToJsonType(field.type),
        description: field.description,
      };

      if (field.type === FieldType.SELECT && field.options.length > 0) {
        properties[field.name].enum = field.options.map(
          (opt: any) => opt.value,
        );
      }

      if (field.required) {
        required.push(field.name);
      }
    }

    return {
      type: "object",
      properties,
      required,
    };
  }

  /**
   * Build extraction prompt for AI
   */
  private buildExtractionPrompt(content: string, form: any): string {
    const fieldsDescription = form.fields
      .map(
        (field: any) =>
          `- ${field.label} (${field.name}): ${field.description}${field.required ? " [REQUIRED]" : " [OPTIONAL]"}
  Type: ${field.type}${field.options && field.options.length > 0 ? `\n  Options: ${field.options.map((o: any) => o.label).join(", ")}` : ""}`,
      )
      .join("\n\n");

    return `You are a data extraction assistant. Extract structured information from the following text based on the specified fields.

FORM: ${form.name}
${form.description ? `DESCRIPTION: ${form.description}\n` : ""}
FIELDS TO EXTRACT:
${fieldsDescription}

TEXT TO ANALYZE:
${content}

INSTRUCTIONS:
1. Extract the requested information from the text above
2. For REQUIRED fields, try your best to find the information
3. If a REQUIRED field cannot be found, set it to null
4. For OPTIONAL fields, only include them if the information is clearly present
5. Follow the specified field types and options
6. Return ONLY a valid JSON object with the extracted data
7. Use the exact field names (name property) as JSON keys

Return the data in this JSON format:
{
  "field_name_1": "extracted value",
  "field_name_2": "extracted value",
  ...
}`;
  }

  /**
   * Map form field type to JSON schema type
   */
  private mapFieldTypeToJsonType(fieldType: FieldType): string {
    switch (fieldType) {
      case FieldType.NUMBER:
        return "number";
      case FieldType.BOOLEAN:
      case FieldType.CHECKBOX:
        return "boolean";
      case FieldType.MULTISELECT:
        return "array";
      case FieldType.JSON:
        return "object";
      default:
        return "string";
    }
  }

  /**
   * Identify missing required fields
   */
  private identifyMissingFields(form: any, extractedData: any): string[] {
    const missingFields: string[] = [];

    for (const field of form.fields) {
      if (field.required) {
        const value = extractedData[field.name];
        if (value === null || value === undefined || value === "") {
          missingFields.push(field.name);
        }
      }
    }

    return missingFields;
  }

  /**
   * Re-extract data (useful after user updates memo content)
   */
  async reExtractData(
    memoId: string,
    userId: string,
  ): Promise<ExtractionResult> {
    const memo = await prisma.memo.findUnique({
      where: { id: memoId },
    });

    if (!memo) {
      throw new Error("Memo not found");
    }

    if (!memo.formId) {
      throw new Error("Memo does not have an associated form");
    }

    return this.extractDataFromMemo(memoId, memo.formId, userId);
  }
}

export const extractionService = new ExtractionService();
