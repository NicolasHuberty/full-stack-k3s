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
    const schema = this.buildJsonSchema(form);

    // Create extraction prompt with JSON schema
    const prompt = this.buildExtractionPrompt(memo.content, form, schema);

    console.log("[Extraction] Memo content:", memo.content);
    console.log("[Extraction] Form fields:", form.fields.map((f: any) => ({ name: f.name, type: f.type, required: f.required })));
    console.log("[Extraction] JSON Schema:", JSON.stringify(schema, null, 2));

    // Call Mistral AI for extraction with JSON schema
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
        schema: schema,
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

    console.log("[Extraction] AI extracted data:", extractedData);

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
  private buildExtractionPrompt(content: string, form: any, schema: any): string {
    const fieldsDescription = form.fields
      .map(
        (field: any) =>
          `- "${field.name}": ${field.description}${field.required ? " [REQUIRED]" : ""}${field.options && field.options.length > 0 ? `\n  Valid options: ${field.options.map((o: any) => `"${o.value}"`).join(", ")}` : ""}`,
      )
      .join("\n");

    return `Extract structured information from the following text to fill out this form: "${form.name}".
${form.description ? `Form description: ${form.description}\n` : ""}
Fields to extract:
${fieldsDescription}

IMPORTANT INSTRUCTIONS:
- Extract the semantic content regardless of the language used in the text
- For REQUIRED fields, extract the best matching information. If truly not found, use null
- For optional fields, only include if clearly present in the text
- For SELECT fields, use only the valid option values provided
- The JSON schema will enforce the correct field names and types

TEXT TO ANALYZE:
${content}`;
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
