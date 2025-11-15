import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { formService } from "@/services/form.service";

// POST /api/forms/[id]/duplicate - Duplicate form
export async function POST(
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
    const { teamId } = body;

    const form = await formService.duplicateForm(id, session.user.id, teamId);

    return NextResponse.json({ data: form }, { status: 201 });
  } catch (error) {
    console.error("Duplicate form error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to duplicate form",
      },
      { status: 500 },
    );
  }
}
