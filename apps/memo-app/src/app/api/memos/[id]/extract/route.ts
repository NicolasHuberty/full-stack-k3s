import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { memoService } from "@/services";
import { extractionService } from "@/services/extraction.service";
import { notificationService } from "@/services/notification.service";

// POST /api/memos/[id]/extract - Extract structured data from memo
export async function POST(
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

    // Check ownership
    const memo = await memoService.getMemoById(id);
    if (!memo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }
    if (memo.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { formId } = body;

    if (!formId) {
      return NextResponse.json(
        { error: "Form ID is required" },
        { status: 400 },
      );
    }

    // Extract data
    const result = await extractionService.extractDataFromMemo(
      id,
      formId,
      session.user.id,
    );

    // If there are missing required fields, create notification
    if (result.missingFields.length > 0) {
      await notificationService.createMissingFieldsNotification(
        session.user.id,
        id,
        result.missingFields,
      );
    }

    return NextResponse.json({
      data: result.data,
      missingFields: result.missingFields,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("Extract data error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to extract data",
      },
      { status: 500 },
    );
  }
}
