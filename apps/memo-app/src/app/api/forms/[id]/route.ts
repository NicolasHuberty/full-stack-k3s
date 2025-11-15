import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { formService } from "@/services/form.service";

// GET /api/forms/[id] - Get form by ID
export async function GET(
  _request: NextRequest,
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
    const form = await formService.getForm(id, userId);

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    return NextResponse.json({ data: form });
  } catch (error) {
    console.error("Get form error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get form" },
      { status: 500 },
    );
  }
}

// PATCH /api/forms/[id] - Update form
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const form = await formService.updateForm(id, session.user.id, body);

    return NextResponse.json({ data: form });
  } catch (error) {
    console.error("Update form error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update form",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/forms/[id] - Delete form
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await formService.deleteForm(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete form error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete form",
      },
      { status: 500 },
    );
  }
}
