import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { publishFormSchema } from "@/dto";
import { auth } from "@/lib/auth";
import { formService } from "@/services/form.service";

// POST /api/forms/[id]/publish - Publish form or change visibility
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const data = publishFormSchema.parse(body);

    const form = await formService.publishForm(
      id,
      session.user.id,
      data.visibility,
      data.category,
    );

    return NextResponse.json({ data: form });
  } catch (error) {
    console.error("Publish form error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to publish form",
      },
      { status: 500 },
    );
  }
}
