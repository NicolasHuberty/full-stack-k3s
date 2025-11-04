import { type NextRequest, NextResponse } from "next/server";
import { createUserSchema } from "@/dto";
import { userService } from "@/services";

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createUserSchema.parse(body);

    const user = await userService.createUser(data);

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
