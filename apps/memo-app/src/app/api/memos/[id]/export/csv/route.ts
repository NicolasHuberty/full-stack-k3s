import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/memos/[id]/export/csv - Export form data as CSV
export async function GET(
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

    // Get memo with form data
    const memo = await prisma.memo.findUnique({
      where: { id },
      include: {
        formData: {
          include: {
            form: {
              include: {
                fields: {
                  include: {
                    options: true,
                  },
                  orderBy: {
                    order: "asc",
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!memo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    // Check ownership
    if (memo.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!memo.formData) {
      return NextResponse.json(
        { error: "No form data to export" },
        { status: 404 },
      );
    }

    // Generate CSV
    const fields = memo.formData.form.fields;
    const data = memo.formData.data as Record<string, any>;

    // CSV header
    const headers = fields.map((f) => f.label);
    const csvHeaders = headers.join(",");

    // CSV data row
    const values = fields.map((f) => {
      const value = data[f.name];
      if (value === null || value === undefined || value === "") {
        return "";
      }
      if (Array.isArray(value)) {
        return `"${value.join("; ")}"`;
      }
      if (typeof value === "object") {
        return `"${JSON.stringify(value)}"`;
      }
      const stringValue = String(value);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    const csvData = values.join(",");

    const csv = `${csvHeaders}\n${csvData}`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="memo-${id}-form-data.csv"`,
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to export CSV",
      },
      { status: 500 },
    );
  }
}
