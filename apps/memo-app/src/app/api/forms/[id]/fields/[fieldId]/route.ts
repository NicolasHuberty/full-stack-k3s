import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import type { FieldType } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { formService } from "@/services/form.service";

// PATCH /api/forms/[id]/fields/[fieldId] - Update field
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> },
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fieldId } = await params;
    const body = await request.json();

    const field = await formService.updateFormField(
      fieldId,
      session.user.id,
      body,
    );

    return NextResponse.json({ data: field });
  } catch (error) {
    console.error("Update field error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update field",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/forms/[id]/fields/[fieldId] - Delete field
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> },
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fieldId } = await params;
    await formService.deleteFormField(fieldId, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete field error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete field",
      },
      { status: 500 },
    );
  }
}
