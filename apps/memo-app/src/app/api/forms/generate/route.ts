import { Mistral } from "@mistralai/mistralai";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import type { FieldType } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

interface GeneratedFormField {
  name: string;
  label: string;
  description: string;
  type: string;
  required?: boolean;
  options?: string[];
}

interface GeneratedFormSchema {
  name: string;
  description?: string;
  category?: string;
  fields: GeneratedFormField[];
}

// POST /api/forms/generate - Generate form from natural language
export async function POST(request: NextRequest) {
  try {
    let session;
    try {
      session = await auth.api.getSession({
        headers: await headers(),
      });
    } catch (sessionError) {
      console.warn("Session error (continuing with demo user):", sessionError);
    }

    // Use demo user if not logged in
    const userId = session?.user?.id || "00000000-0000-0000-0000-000000000000";

    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    // Generate form schema with AI
    const completion = await mistral.chat.complete({
      model: "mistral-large-latest",
      messages: [
        {
          role: "user",
          content: `You are a form builder AI. Based on the user's description, generate a JSON schema for a data extraction form.

User's request: ${prompt}

Generate a form with the following structure:
{
  "name": "Form name (concise, descriptive)",
  "description": "Brief description of what this form extracts",
  "category": "Category like 'Business', 'Customer Service', 'Finance', 'General'",
  "fields": [
    {
      "name": "field_name_in_snake_case",
      "label": "Human readable label",
      "description": "Clear instruction for AI on what to extract from the document",
      "type": "TEXT|TEXTAREA|NUMBER|EMAIL|PHONE|DATE|DATETIME|SELECT|MULTISELECT|CHECKBOX|BOOLEAN|URL",
      "required": true/false,
      "options": ["option1", "option2"] // Only for SELECT/MULTISELECT/RADIO types
    }
  ]
}

Important guidelines:
- Use appropriate field types based on the data
- For multiple choice fields, use SELECT (single choice) or MULTISELECT (multiple choices)
- For yes/no questions, use BOOLEAN or CHECKBOX
- Make critical fields required, others optional
- Write clear, specific AI extraction descriptions
- Order fields logically
- Use TEXTAREA for long text, TEXT for short strings
- Include at least 3-8 fields
- Be creative but practical

Return ONLY the JSON schema, no other text.`,
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

    const contentString =
      typeof responseContent === "string"
        ? responseContent
        : JSON.stringify(responseContent);
    const formSchema = JSON.parse(contentString) as GeneratedFormSchema;

    // Create form in database
    const form = await prisma.form.create({
      data: {
        name: formSchema.name,
        description: formSchema.description,
        category: formSchema.category,
        createdBy: userId,
        fields: {
          create: formSchema.fields.map(
            (field: GeneratedFormField, index: number) => ({
              name: field.name,
              label: field.label,
              description: field.description,
              type: field.type as FieldType,
              required: field.required || false,
              order: index,
              options: field.options
                ? {
                    create: field.options.map(
                      (opt: string, optIndex: number) => ({
                        label: opt,
                        value: opt.toLowerCase().replace(/\s+/g, "_"),
                        order: optIndex,
                      }),
                    ),
                  }
                : undefined,
            }),
          ),
        },
      },
      include: {
        fields: {
          include: {
            options: true,
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    return NextResponse.json({ data: form }, { status: 201 });
  } catch (error) {
    console.error("Generate form error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate form",
      },
      { status: 500 },
    );
  }
}
