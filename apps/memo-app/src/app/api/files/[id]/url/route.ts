import { NextRequest, NextResponse } from "next/server";
import { fileService } from "@/services";

// GET /api/files/[id]/url - Get presigned download URL
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = await fileService.getFileDownloadUrl(id);

    return NextResponse.json({ data: { url } });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
