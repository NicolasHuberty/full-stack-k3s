"use client";

import { ArrowLeft, Copy, Edit, Globe, Plus, Trash2, Upload } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface FormField {
  id: string;
  name: string;
  label: string;
  description: string;
  type: string;
  required: boolean;
  order: number;
  options?: Array<{ label: string; value: string }>;
}

interface Form {
  id: string;
  name: string;
  description?: string;
  category?: string;
  isPublic: boolean;
  visibility: "PRIVATE" | "TEAM" | "ORGANIZATION" | "PUBLIC";
  createdAt: string;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  fields: FormField[];
  _count: {
    submissions: number;
  };
}

export default function FormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [visibility, setVisibility] = useState<"PRIVATE" | "TEAM" | "ORGANIZATION" | "PUBLIC">("PRIVATE");
  const [category, setCategory] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [saving, setSaving] = useState(false);

  // Field editing state
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [fieldName, setFieldName] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldDescription, setFieldDescription] = useState("");
  const [fieldType, setFieldType] = useState<string>("SHORT_TEXT");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [savingField, setSavingField] = useState(false);

  useEffect(() => {
    loadForm();
  }, [id]);

  const loadForm = async () => {
    try {
      const res = await fetch(`/api/forms/${id}`);
      if (!res.ok) {
        throw new Error("Form not found");
      }
      const { data } = await res.json();
      setForm(data);
      setEditName(data.name);
      setEditDescription(data.description || "");
      setEditCategory(data.category || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load form");
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/forms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          category: editCategory,
        }),
      });

      if (res.ok) {
        await loadForm();
        setEditMode(false);
      } else {
        const error = await res.json();
        throw new Error(error.error || "Failed to update form");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update form");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditName(form?.name || "");
    setEditDescription(form?.description || "");
    setEditCategory(form?.category || "");
    setEditMode(false);
  };

  const deleteForm = async () => {
    if (!confirm("Are you sure you want to delete this form?")) return;

    try {
      const res = await fetch(`/api/forms/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/forms");
      } else {
        throw new Error("Failed to delete form");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete form");
    }
  };

  const duplicateForm = async () => {
    try {
      const res = await fetch(`/api/forms/${id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const { data } = await res.json();
        router.push(`/forms/${data.id}`);
      } else {
        throw new Error("Failed to duplicate form");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to duplicate form");
    }
  };

  const publishForm = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/forms/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility, category }),
      });

      if (res.ok) {
        setPublishDialogOpen(false);
        await loadForm(); // Reload to show updated status
        alert(`Form published successfully as ${visibility}`);
      } else {
        const error = await res.json();
        throw new Error(error.error || "Failed to publish form");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to publish form");
    } finally {
      setPublishing(false);
    }
  };

  const openAddFieldDialog = () => {
    setEditingField(null);
    setFieldName("");
    setFieldLabel("");
    setFieldDescription("");
    setFieldType("SHORT_TEXT");
    setFieldRequired(false);
    setFieldDialogOpen(true);
  };

  const openEditFieldDialog = (field: FormField) => {
    setEditingField(field);
    setFieldName(field.name);
    setFieldLabel(field.label);
    setFieldDescription(field.description);
    setFieldType(field.type);
    setFieldRequired(field.required);
    setFieldDialogOpen(true);
  };

  const saveField = async () => {
    if (!fieldName.trim() || !fieldLabel.trim() || !fieldDescription.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    setSavingField(true);
    try {
      if (editingField) {
        // Update existing field
        const res = await fetch(`/api/forms/${id}/fields/${editingField.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fieldName,
            label: fieldLabel,
            description: fieldDescription,
            type: fieldType,
            required: fieldRequired,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to update field");
        }
      } else {
        // Add new field
        const nextOrder = form?.fields.length || 0;
        const res = await fetch(`/api/forms/${id}/fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fieldName,
            label: fieldLabel,
            description: fieldDescription,
            type: fieldType,
            required: fieldRequired,
            order: nextOrder,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to add field");
        }
      }

      setFieldDialogOpen(false);
      await loadForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save field");
    } finally {
      setSavingField(false);
    }
  };

  const deleteField = async (fieldId: string, fieldName: string) => {
    if (!confirm(`Are you sure you want to delete the field "${fieldName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/forms/${id}/fields/${fieldId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await loadForm();
      } else {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete field");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete field");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h2 className="text-2xl font-bold text-destructive mb-2">Error</h2>
            <p className="text-muted-foreground mb-4">
              {error || "Form not found"}
            </p>
            <Link href="/forms">
              <Button>
                <ArrowLeft className="size-4 mr-2" />
                Back to Forms
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/forms">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="size-4 mr-2" />
              Back to Forms
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold">{form.name}</h1>
                {form.isPublic && (
                  <Badge variant="secondary">
                    <Globe className="size-3 mr-1" />
                    Public
                  </Badge>
                )}
              </div>
              {form.description && (
                <p className="text-muted-foreground">{form.description}</p>
              )}
              {form.category && (
                <Badge variant="outline" className="mt-2">
                  {form.category}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {/* Edit Form Dialog */}
              <Dialog open={editMode} onOpenChange={setEditMode}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Edit Form</DialogTitle>
                    <DialogDescription>
                      Update your form information
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Form Name</Label>
                      <Input
                        id="edit-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Form name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Form description"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-category">Category</Label>
                      <Input
                        id="edit-category"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        placeholder="e.g., Business, Finance, HR..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={cancelEdit}>
                      Cancel
                    </Button>
                    <Button onClick={saveEdit} disabled={saving || !editName.trim()}>
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="size-4 mr-2" />
                    {form.visibility === "PUBLIC" ? "Update Visibility" : "Publish"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Publish Form</DialogTitle>
                    <DialogDescription>
                      Choose who can see and use this form
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="visibility">Visibility</Label>
                      <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
                        <SelectTrigger id="visibility">
                          <SelectValue placeholder="Select visibility" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRIVATE">
                            <div>
                              <div className="font-medium">Private</div>
                              <div className="text-xs text-muted-foreground">Only you can see this</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="TEAM">
                            <div>
                              <div className="font-medium">Team</div>
                              <div className="text-xs text-muted-foreground">Team members can see this</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="ORGANIZATION">
                            <div>
                              <div className="font-medium">Organization</div>
                              <div className="text-xs text-muted-foreground">All users can see this</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="PUBLIC">
                            <div>
                              <div className="font-medium">Public</div>
                              <div className="text-xs text-muted-foreground">Everyone can see (marketplace)</div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category (optional)</Label>
                      <Input
                        id="category"
                        placeholder="e.g., Business, Finance, HR..."
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={publishForm} disabled={publishing}>
                      {publishing ? "Publishing..." : "Publish"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={duplicateForm}>
                <Copy className="size-4 mr-2" />
                Duplicate
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                <Edit className="size-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deleteForm}
                className="text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{form.fields.length}</p>
                <p className="text-sm text-muted-foreground">Fields</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{form._count.submissions}</p>
                <p className="text-sm text-muted-foreground">Uses</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">
                  {form.fields.filter((f) => f.required).length}
                </p>
                <p className="text-sm text-muted-foreground">Required</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form Fields */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Form Fields</CardTitle>
                <CardDescription>
                  These fields will be extracted by AI from your documents
                </CardDescription>
              </div>
              <Button size="sm" onClick={openAddFieldDialog}>
                <Plus className="size-4 mr-2" />
                Add Field
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {form.fields.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No fields defined yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {form.fields
                  .sort((a, b) => a.order - b.order)
                  .map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-start gap-4 p-4 border rounded-lg"
                    >
                      <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary font-semibold shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold">{field.label}</h3>
                          {field.required && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {field.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {field.description}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          Field name: <code className="bg-muted px-1 py-0.5 rounded">{field.name}</code>
                        </div>
                        {field.options && field.options.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {field.options.map((opt) => (
                              <Badge
                                key={opt.value}
                                variant="secondary"
                                className="text-xs"
                              >
                                {opt.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditFieldDialog(field)}
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteField(field.id, field.label)}
                          className="text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Creator Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Form Information</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created by</span>
              <span>{form.creator.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created on</span>
              <span>{new Date(form.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Form ID</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {form.id}
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Field Add/Edit Dialog */}
        <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingField ? "Edit Field" : "Add Field"}
              </DialogTitle>
              <DialogDescription>
                {editingField
                  ? "Update the field properties"
                  : "Add a new field to extract from documents"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="field-name">
                  Field Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="field-name"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="e.g., customer_name"
                />
                <p className="text-xs text-muted-foreground">
                  Internal name used in the database (lowercase, no spaces)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-label">
                  Display Label <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="field-label"
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                  placeholder="e.g., Customer Name"
                />
                <p className="text-xs text-muted-foreground">
                  User-friendly label shown in the interface
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="field-description"
                  value={fieldDescription}
                  onChange={(e) => setFieldDescription(e.target.value)}
                  placeholder="Describe what this field represents and how it should be extracted"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Help the AI understand what to extract from documents
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-type">Field Type</Label>
                <Select value={fieldType} onValueChange={setFieldType}>
                  <SelectTrigger id="field-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHORT_TEXT">Short Text</SelectItem>
                    <SelectItem value="LONG_TEXT">Long Text</SelectItem>
                    <SelectItem value="NUMBER">Number</SelectItem>
                    <SelectItem value="DATE">Date</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="PHONE">Phone</SelectItem>
                    <SelectItem value="URL">URL</SelectItem>
                    <SelectItem value="BOOLEAN">Yes/No</SelectItem>
                    <SelectItem value="SELECT">Select (Dropdown)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="field-required"
                  checked={fieldRequired}
                  onCheckedChange={(checked) =>
                    setFieldRequired(checked as boolean)
                  }
                />
                <Label
                  htmlFor="field-required"
                  className="text-sm font-normal cursor-pointer"
                >
                  This field is required
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setFieldDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={saveField}
                disabled={
                  savingField ||
                  !fieldName.trim() ||
                  !fieldLabel.trim() ||
                  !fieldDescription.trim()
                }
              >
                {savingField
                  ? "Saving..."
                  : editingField
                    ? "Save Changes"
                    : "Add Field"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
