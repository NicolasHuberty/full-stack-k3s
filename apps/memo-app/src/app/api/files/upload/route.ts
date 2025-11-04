import { type NextRequest, NextResponse } from "next/server";
import { fileService } from "@/services";

export const runtime = "nodejs";

// POST /api/files/upload - Upload a file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to MinIO and create database record
    const result = await fileService.uploadFile(buffer, {
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("File upload error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
