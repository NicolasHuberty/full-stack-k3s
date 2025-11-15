import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendMemoCompletedEmail } from "@/lib/email";
import { memoService } from "@/services";

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

    // Get memo with user info
    const memo = await memoService.getMemoById(id, true);

    if (!memo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    // Check ownership
    if (memo.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get user email
    const user = await memoService.getUserById(memo.userId);
    if (!user || !user.email) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 404 },
      );
    }

    // Send email notification
    await sendMemoCompletedEmail(
      user.email,
      memo.title,
      memo.content,
      memo.id,
      "files" in memo
        ? memo.files?.map((f) => ({
            filename: f.filename,
            path: f.id,
          }))
        : undefined,
    );

    return NextResponse.json({
      success: true,
      message: "Email notification sent",
    });
  } catch (error) {
    console.error("Failed to send memo notification:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 },
    );
  }
}
