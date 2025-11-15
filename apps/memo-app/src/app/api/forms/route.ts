import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createFormSchema } from "@/dto";
import { auth } from "@/lib/auth";
import { formService } from "@/services/form.service";

// GET /api/forms - Get all forms for current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeTeamForms = searchParams.get("includeTeams") !== "false";

    const forms = await formService.getUserForms(
      session.user.id,
      includeTeamForms,
    );

    return NextResponse.json({ data: forms });
  } catch (error) {
    console.error("Get forms error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get forms" },
      { status: 500 },
    );
  }
}

// POST /api/forms - Create new form
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createFormSchema.parse(body);

    const form = await formService.createForm(session.user.id, data);

    return NextResponse.json({ data: form }, { status: 201 });
  } catch (error) {
    console.error("Create form error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create form",
      },
      { status: 500 },
    );
  }
}
