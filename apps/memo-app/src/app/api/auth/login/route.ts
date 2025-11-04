import { type NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/dto";
import { userService } from "@/services";

// POST /api/auth/login - Login user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);

    const user = await userService.login(data);

    // TODO: Create session/JWT token here
    // For now, just return the user

    return NextResponse.json({ data: user });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
