import { type NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { FieldType } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/memos/[id]/export/form-pdf - Export form data as formatted PDF
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

    // Generate PDF
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    // Title
    doc.setFontSize(20);
    doc.text(memo.formData.form.name, pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    // Description
    if (memo.formData.form.description) {
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      const descLines = doc.splitTextToSize(memo.formData.form.description, pageWidth - 2 * margin);
      doc.text(descLines, pageWidth / 2, yPos, { align: "center" });
      yPos += descLines.length * 5 + 5;
      doc.setTextColor(0, 0, 0);
    }

    // Memo metadata
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`,
      pageWidth / 2,
      yPos,
      { align: "center" }
    );
    yPos += 15;
    doc.setTextColor(0, 0, 0);

    // Fields
    const fields = memo.formData.form.fields;
    const data = memo.formData.data as Record<string, any>;
    const missingFields = memo.formData.missingFields as string[];

    for (const field of fields) {
      const value = data[field.name];
      const isMissing = missingFields.includes(field.name);

      // Check if we need a new page
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      // Field label
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(field.label + (field.required ? " *" : ""), margin, yPos);
      yPos += 5;

      // Field description
      if (field.description) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const descLines = doc.splitTextToSize(field.description, pageWidth - 2 * margin);
        doc.text(descLines, margin, yPos);
        yPos += descLines.length * 4 + 2;
        doc.setTextColor(0, 0, 0);
      }

      // Draw box for value
      const boxHeight = 12;

      // Background color for missing fields
      if (isMissing) {
        doc.setFillColor(255, 244, 229);
        doc.setDrawColor(255, 165, 0);
        doc.rect(margin, yPos, pageWidth - 2 * margin, boxHeight, "FD");
      } else {
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, yPos, pageWidth - 2 * margin, boxHeight);
      }

      // Value text
      let displayValue = "";

      if (value === null || value === undefined || value === "") {
        displayValue = isMissing ? "Non renseigné" : "";
        doc.setTextColor(150, 150, 150);
      } else if (Array.isArray(value)) {
        displayValue = value.join(", ");
      } else if (field.type === FieldType.BOOLEAN || field.type === FieldType.CHECKBOX) {
        displayValue = value ? "[X] Oui" : "[ ] Non";
      } else if (field.type === FieldType.DATE) {
        displayValue = new Date(value).toLocaleDateString("fr-FR");
      } else if (field.type === FieldType.DATETIME) {
        displayValue = new Date(value).toLocaleString("fr-FR");
      } else if (typeof value === "object") {
        displayValue = JSON.stringify(value);
      } else {
        displayValue = String(value);
      }

      doc.setFontSize(10);
      const valueLines = doc.splitTextToSize(displayValue, pageWidth - 2 * margin - 4);
      doc.text(valueLines[0] || "", margin + 2, yPos + 7);
      doc.setTextColor(0, 0, 0);

      yPos += boxHeight + 8;
    }

    // Footer with validation status
    yPos += 10;
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(9);
    if (missingFields.length > 0) {
      doc.setTextColor(255, 107, 0);
      doc.text(
        `! ${missingFields.length} champ(s) requis manquant(s): ${missingFields.join(", ")}`,
        pageWidth / 2,
        yPos,
        { align: "center", maxWidth: pageWidth - 2 * margin }
      );
    } else {
      doc.setTextColor(0, 170, 0);
      doc.text("Tous les champs requis sont remplis", pageWidth / 2, yPos, { align: "center" });
    }

    // Convert to blob
    const pdfBlob = doc.output("blob");

    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="memo-${id}-form.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to export PDF",
      },
      { status: 500 },
    );
  }
}
