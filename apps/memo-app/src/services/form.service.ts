import {
  type FieldType,
  FormVisibility,
  ValidationStatus,
} from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export interface CreateFormInput {
  name: string;
  description?: string;
  teamId?: string;
  isPublic?: boolean;
  visibility?: FormVisibility;
  category?: string;
}

export interface CreateFormFieldInput {
  name: string;
  label: string;
  description: string;
  type: FieldType;
  required?: boolean;
  order: number;
  defaultValue?: string;
  validationRules?: any;
  options?: Array<{ label: string; value: string; order: number }>;
}

export class FormService {
  /**
   * Create a new form
   */
  async createForm(userId: string, data: CreateFormInput) {
    // If teamId is provided, verify user is a member
    if (data.teamId) {
      const member = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId,
            teamId: data.teamId,
          },
        },
      });

      if (!member) {
        throw new Error("You must be a member of this team");
      }
    }

    // Determine visibility and isPublic based on input
    let visibility = data.visibility || FormVisibility.PRIVATE;
    let isPublic = data.isPublic || false;
    let publishedAt: Date | undefined;

    // If isPublic is true, set visibility to PUBLIC and publishedAt
    if (isPublic) {
      visibility = FormVisibility.PUBLIC;
      publishedAt = new Date();
    } else if (visibility === FormVisibility.PUBLIC) {
      isPublic = true;
      publishedAt = new Date();
    }

    const form = await prisma.form.create({
      data: {
        name: data.name,
        description: data.description,
        createdBy: userId,
        teamId: data.teamId,
        isPublic,
        visibility,
        publishedAt,
        category: data.category,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: true,
        fields: {
          include: {
            options: true,
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    return form;
  }

  /**
   * Add field to form
   */
  async addFormField(
    formId: string,
    userId: string,
    data: CreateFormFieldInput,
  ) {
    // Verify user owns the form or is team member
    const form = await this.getForm(formId, userId);
    if (!form) {
      throw new Error("Form not found or you don't have permission");
    }

    const field = await prisma.formField.create({
      data: {
        formId,
        name: data.name,
        label: data.label,
        description: data.description,
        type: data.type,
        required: data.required || false,
        order: data.order,
        defaultValue: data.defaultValue,
        validationRules: data.validationRules,
        options: data.options
          ? {
              create: data.options,
            }
          : undefined,
      },
      include: {
        options: true,
      },
    });

    return field;
  }

  /**
   * Update form field
   */
  async updateFormField(
    fieldId: string,
    userId: string,
    data: Partial<CreateFormFieldInput>,
  ) {
    // Get field and verify permissions
    const field = await prisma.formField.findUnique({
      where: { id: fieldId },
      include: { form: true },
    });

    if (!field) {
      throw new Error("Field not found");
    }

    // Verify user owns the form or is team member
    const hasAccess = await this.checkFormAccess(field.formId, userId);
    if (!hasAccess) {
      throw new Error("You don't have permission to edit this form");
    }

    const updated = await prisma.formField.update({
      where: { id: fieldId },
      data: {
        name: data.name,
        label: data.label,
        description: data.description,
        type: data.type,
        required: data.required,
        order: data.order,
        defaultValue: data.defaultValue,
        validationRules: data.validationRules,
      },
      include: {
        options: true,
      },
    });

    return updated;
  }

  /**
   * Delete form field
   */
  async deleteFormField(fieldId: string, userId: string) {
    const field = await prisma.formField.findUnique({
      where: { id: fieldId },
      include: { form: true },
    });

    if (!field) {
      throw new Error("Field not found");
    }

    const hasAccess = await this.checkFormAccess(field.formId, userId);
    if (!hasAccess) {
      throw new Error("You don't have permission to edit this form");
    }

    await prisma.formField.delete({
      where: { id: fieldId },
    });
  }

  /**
   * Get form by ID
   */
  async getForm(formId: string, userId?: string) {
    const form = await prisma.form.findFirst({
      where: {
        id: formId,
        OR: [
          { isPublic: true },
          { createdBy: userId },
          {
            team: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
        ],
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: true,
        fields: {
          include: {
            options: {
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
        _count: {
          select: {
            submissions: true,
            reviews: true,
          },
        },
      },
    });

    return form;
  }

  /**
   * Get all forms accessible to user
   */
  async getUserForms(userId: string, includeTeamForms = true) {
    const forms = await prisma.form.findMany({
      where: includeTeamForms
        ? {
            OR: [
              { createdBy: userId },
              {
                team: {
                  members: {
                    some: {
                      userId,
                    },
                  },
                },
              },
            ],
          }
        : {
            createdBy: userId,
          },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            fields: true,
            submissions: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return forms;
  }

  /**
   * Get public forms (marketplace)
   */
  async getPublicForms(category?: string) {
    const forms = await prisma.form.findMany({
      where: {
        visibility: FormVisibility.PUBLIC,
        category: category || undefined,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        _count: {
          select: {
            fields: true,
            submissions: true,
            reviews: true,
          },
        },
      },
      orderBy: [{ rating: "desc" }, { usageCount: "desc" }],
    });

    return forms;
  }

  /**
   * Get forms accessible to user based on visibility
   */
  async getAccessibleForms(userId: string, category?: string) {
    const forms = await prisma.form.findMany({
      where: {
        OR: [
          // Public forms
          { visibility: FormVisibility.PUBLIC },
          // Organization forms (all users can see)
          { visibility: FormVisibility.ORGANIZATION },
          // Team forms (user is a member)
          {
            visibility: FormVisibility.TEAM,
            team: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
          // Private forms (user is creator)
          {
            visibility: FormVisibility.PRIVATE,
            createdBy: userId,
          },
        ],
        category: category || undefined,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            fields: true,
            submissions: true,
            reviews: true,
          },
        },
      },
      orderBy: [{ rating: "desc" }, { usageCount: "desc" }],
    });

    return forms;
  }

  /**
   * Publish form to marketplace or change visibility
   */
  async publishForm(
    formId: string,
    userId: string,
    visibility: FormVisibility,
    category?: string,
  ) {
    const hasAccess = await this.checkFormAccess(formId, userId);
    if (!hasAccess) {
      throw new Error("You don't have permission to publish this form");
    }

    const updateData: any = {
      visibility,
      category,
    };

    // If publishing as PUBLIC, set publishedAt and isPublic
    if (visibility === FormVisibility.PUBLIC) {
      updateData.isPublic = true;
      updateData.publishedAt = new Date();
    } else {
      updateData.isPublic = false;
    }

    const form = await prisma.form.update({
      where: { id: formId },
      data: updateData,
    });

    return form;
  }

  /**
   * Duplicate form (for marketplace imports)
   */
  async duplicateForm(formId: string, userId: string, teamId?: string) {
    const sourceForm = await this.getForm(formId);
    if (!sourceForm) {
      throw new Error("Form not found");
    }

    // If source form is not public, check access
    if (!sourceForm.isPublic) {
      const hasAccess = await this.checkFormAccess(formId, userId);
      if (!hasAccess) {
        throw new Error("You don't have permission to duplicate this form");
      }
    }

    // Create new form
    const newForm = await prisma.form.create({
      data: {
        name: `${sourceForm.name} (Copy)`,
        description: sourceForm.description,
        createdBy: userId,
        teamId,
        isPublic: false,
        category: sourceForm.category,
        fields: {
          create: sourceForm.fields.map((field) => ({
            name: field.name,
            label: field.label,
            description: field.description,
            type: field.type,
            required: field.required,
            order: field.order,
            defaultValue: field.defaultValue,
            validationRules: field.validationRules || undefined,
            options: {
              create: field.options.map((opt) => ({
                label: opt.label,
                value: opt.value,
                order: opt.order,
              })),
            },
          })),
        },
      },
      include: {
        fields: {
          include: {
            options: true,
          },
        },
      },
    });

    // Increment usage count on source form
    if (sourceForm.isPublic) {
      await prisma.form.update({
        where: { id: formId },
        data: {
          usageCount: {
            increment: 1,
          },
        },
      });
    }

    return newForm;
  }

  /**
   * Save extracted form data for a memo
   */
  async saveMemoFormData(
    memoId: string,
    formId: string,
    userId: string,
    data: any,
    missingFields: string[] = [],
  ) {
    const validationStatus =
      missingFields.length === 0
        ? ValidationStatus.VALID
        : ValidationStatus.PARTIAL;

    const formData = await prisma.memoFormData.upsert({
      where: { memoId },
      create: {
        memoId,
        formId,
        userId,
        data,
        missingFields,
        validationStatus,
      },
      update: {
        data,
        missingFields,
        validationStatus,
        validatedAt: new Date(),
      },
    });

    return formData;
  }

  /**
   * Update form
   */
  async updateForm(
    formId: string,
    userId: string,
    data: Partial<CreateFormInput>,
  ) {
    const hasAccess = await this.checkFormAccess(formId, userId);
    if (!hasAccess) {
      throw new Error("You don't have permission to edit this form");
    }

    const updateData: any = {
      name: data.name,
      description: data.description,
      category: data.category,
    };

    // Handle visibility updates
    if (data.visibility !== undefined) {
      updateData.visibility = data.visibility;

      if (data.visibility === FormVisibility.PUBLIC) {
        updateData.isPublic = true;
        updateData.publishedAt = new Date();
      } else {
        updateData.isPublic = false;
      }
    } else if (data.isPublic !== undefined) {
      updateData.isPublic = data.isPublic;

      if (data.isPublic) {
        updateData.visibility = FormVisibility.PUBLIC;
        updateData.publishedAt = new Date();
      }
    }

    const form = await prisma.form.update({
      where: { id: formId },
      data: updateData,
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
    });

    return form;
  }

  /**
   * Delete form
   */
  async deleteForm(formId: string, userId: string) {
    const form = await prisma.form.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new Error("Form not found");
    }

    if (form.createdBy !== userId) {
      throw new Error("Only the form creator can delete this form");
    }

    await prisma.form.delete({
      where: { id: formId },
    });
  }

  /**
   * Check if user has access to form
   */
  private async checkFormAccess(
    formId: string,
    userId: string,
  ): Promise<boolean> {
    const form = await prisma.form.findFirst({
      where: {
        id: formId,
        OR: [
          { createdBy: userId },
          {
            team: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
        ],
      },
    });

    return !!form;
  }

  /**
   * Add review to form
   */
  async addReview(
    formId: string,
    userId: string,
    rating: number,
    comment?: string,
  ) {
    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const review = await prisma.formReview.upsert({
      where: {
        formId_userId: {
          formId,
          userId,
        },
      },
      create: {
        formId,
        userId,
        rating,
        comment,
      },
      update: {
        rating,
        comment,
      },
    });

    // Recalculate average rating
    const reviews = await prisma.formReview.findMany({
      where: { formId },
    });

    const avgRating =
      reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await prisma.form.update({
      where: { id: formId },
      data: { rating: avgRating },
    });

    return review;
  }
}

export const formService = new FormService();
