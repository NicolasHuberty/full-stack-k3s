import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import type { FieldType } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { formService } from "@/services/form.service";

// POST /api/forms/[id]/fields - Add field to form
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      label,
      description,
      type,
      required,
      order,
      defaultValue,
      validationRules,
      options,
    } = body;

    if (!name || !label || !description || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const field = await formService.addFormField(id, userId, {
      name,
      label,
      description,
      type: type as FieldType,
      required: required || false,
      order: order || 0,
      defaultValue,
      validationRules,
      options,
    });

    return NextResponse.json({ data: field }, { status: 201 });
  } catch (error) {
    console.error("Add field error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add field",
      },
      { status: 500 },
    );
  }
}
