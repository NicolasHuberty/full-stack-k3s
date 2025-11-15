import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formService } from "@/services";

export const runtime = "nodejs";

// PATCH /api/memos/[id]/form-data - Update form data
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { data } = body;

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "Invalid data format" },
        { status: 400 },
      );
    }

    // Get existing form data
    const memo = await prisma.memo.findUnique({
      where: { id },
      include: {
        formData: {
          include: {
            form: {
              include: {
                fields: true,
              },
            },
          },
        },
      },
    });

    if (!memo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    // Check ownership
    if (memo.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!memo.formData) {
      return NextResponse.json(
        { error: "No form data to update" },
        { status: 404 },
      );
    }

    // Identify missing required fields
    const missingFields: string[] = [];
    for (const field of memo.formData.form.fields) {
      if (field.required) {
        const value = data[field.name];
        if (value === null || value === undefined || value === "") {
          missingFields.push(field.name);
        }
      }
    }

    // Update form data
    const updatedFormData = await formService.saveMemoFormData(
      id,
      memo.formData.formId,
      memo.userId,
      data,
      missingFields,
    );

    return NextResponse.json({ data: updatedFormData });
  } catch (error) {
    console.error("Update form data error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update form data",
      },
      { status: 500 },
    );
  }
}
