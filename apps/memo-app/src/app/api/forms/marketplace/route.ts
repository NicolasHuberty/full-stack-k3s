import { type NextRequest, NextResponse } from "next/server";
import { formService } from "@/services/form.service";

// GET /api/forms/marketplace - Get public forms
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;

    const forms = await formService.getPublicForms(category);

    return NextResponse.json({ data: forms });
  } catch (error) {
    console.error("Get marketplace forms error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get marketplace forms",
      },
      { status: 500 },
    );
  }
}
