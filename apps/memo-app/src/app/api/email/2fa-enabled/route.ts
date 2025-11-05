import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { send2FAEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    // Get current session
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Send 2FA enabled email
    await send2FAEmail(session.user.email, session.user.name);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Failed to send 2FA email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 },
    );
  }
}
