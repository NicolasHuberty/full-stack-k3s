"use client";

import { ArrowLeft, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const FIELD_TYPES = [
  { value: "TEXT", label: "Short Text", icon: "Aa" },
  { value: "TEXTAREA", label: "Long Text", icon: "¶" },
  { value: "NUMBER", label: "Number", icon: "#" },
  { value: "EMAIL", label: "Email", icon: "@" },
  { value: "PHONE", label: "Phone", icon: "☎" },
  { value: "DATE", label: "Date", icon: "📅" },
  { value: "SELECT", label: "Dropdown", icon: "▼" },
  { value: "MULTISELECT", label: "Multiple Choice", icon: "☑" },
  { value: "BOOLEAN", label: "Yes/No", icon: "✓" },
  { value: "URL", label: "Website", icon: "🔗" },
];

const CATEGORIES = [
  "Business",
  "Finance",
  "Customer Service",
  "HR",
  "Legal",
  "Marketing",
  "Operations",
  "Other",
];

interface FormField {
  id: string;
  name: string;
  label: string;
  description: string;
  type: string;
  required: boolean;
  options?: string[];
}

export default function NewFormPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1: Form Info
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [category, setCategory] = useState("Business");
  const [visibility, setVisibility] = useState<"PRIVATE" | "TEAM" | "ORGANIZATION" | "PUBLIC">("PRIVATE");

  // Step 2: Fields
  const [fields, setFields] = useState<FormField[]>([]);
  const [showAddField, setShowAddField] = useState(false);
  const [currentField, setCurrentField] = useState<FormField>({
    id: "",
    name: "",
    label: "",
    description: "",
    type: "TEXT",
    required: false,
    options: [],
  });

  const [saving, setSaving] = useState(false);

  const addField = () => {
    if (!currentField.label.trim()) {
      alert("Please enter a field label");
      return;
    }

    const newField: FormField = {
      ...currentField,
      id: `field-${Date.now()}`,
      name:
        currentField.name ||
        currentField.label.toLowerCase().replace(/\s+/g, "_"),
    };

    setFields([...fields, newField]);
    setCurrentField({
      id: "",
      name: "",
      label: "",
      description: "",
      type: "TEXT",
      required: false,
      options: [],
    });
    setShowAddField(false);
  };

  const deleteField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const saveForm = async () => {
    if (!formName.trim()) {
      alert("Please enter a form name");
      return;
    }

    if (fields.length === 0) {
      alert("Please add at least one field");
      return;
    }

    setSaving(true);

    try {
      // Create form
      const formRes = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formDescription,
          category,
          visibility,
        }),
      });

      if (!formRes.ok) {
        const errorData = await formRes.json();
        throw new Error(errorData.error || "Failed to create form");
      }

      const { data: form } = await formRes.json();

      // Add fields
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        await fetch(`/api/forms/${form.id}/fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...field,
            order: i,
          }),
        });
      }

      router.push(`/forms/${form.id}`);
    } catch (error) {
      console.error("Save form error:", error);
      alert(error instanceof Error ? error.message : "Failed to save form");
    } finally {
      setSaving(false);
    }
  };

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
          <h1 className="text-4xl font-bold tracking-tight">Create New Form</h1>
          <p className="text-muted-foreground mt-2">
            Design a custom form for AI-powered data extraction
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center size-8 rounded-full ${
                step === 1
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              1
            </div>
            <span
              className={step === 1 ? "font-medium" : "text-muted-foreground"}
            >
              Form Info
            </span>
          </div>
          <div className="h-px flex-1 bg-border" />
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center size-8 rounded-full ${
                step === 2
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              2
            </div>
            <span
              className={step === 2 ? "font-medium" : "text-muted-foreground"}
            >
              Add Fields
            </span>
          </div>
        </div>

        {/* Step 1: Form Information */}
        {step === 1 && (
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Form Information</CardTitle>
              <CardDescription>
                Start by giving your form a name and description
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="form-name">
                  Form Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="form-name"
                  placeholder="e.g., Customer Feedback, Invoice Processing, Meeting Notes"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="text-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="form-description">Description</Label>
                <Textarea
                  id="form-description"
                  placeholder="Describe what data this form will extract..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
                  <SelectTrigger id="visibility">
                    <SelectValue />
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
                        <div className="font-medium">Public (Marketplace)</div>
                        <div className="text-xs text-muted-foreground">Everyone can see and import</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {visibility === "PUBLIC" && "✨ This form will appear in the marketplace for everyone to use"}
                  {visibility === "ORGANIZATION" && "👥 All users in the app can see and use this form"}
                  {visibility === "TEAM" && "👤 Only your team members can see this form"}
                  {visibility === "PRIVATE" && "🔒 This form is only visible to you"}
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!formName.trim()}
                  size="lg"
                >
                  Next: Add Fields
                  <ArrowLeft className="size-4 ml-2 rotate-180" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Add Fields */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Form Summary */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{formName}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formDescription || "No description"}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                    Edit Info
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Fields List */}
            {fields.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Form Fields ({fields.length})</CardTitle>
                  <CardDescription>
                    These fields will be extracted by AI from your documents
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary font-semibold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{field.label}</h3>
                          {field.required && (
                            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                              Required
                            </span>
                          )}
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                            {
                              FIELD_TYPES.find((t) => t.value === field.type)
                                ?.label
                            }
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {field.description || "No description"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteField(field.id)}
                        className="text-destructive shrink-0"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Add Field Button */}
            {!showAddField && (
              <Button
                onClick={() => setShowAddField(true)}
                size="lg"
                className="w-full"
                variant="outline"
              >
                <Plus className="size-4 mr-2" />
                Add Field
              </Button>
            )}

            {/* Add Field Form */}
            {showAddField && (
              <Card className="border-2 border-primary/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>New Field</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddField(false);
                        setCurrentField({
                          id: "",
                          name: "",
                          label: "",
                          description: "",
                          type: "TEXT",
                          required: false,
                          options: [],
                        });
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="field-label">
                      Field Label <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="field-label"
                      placeholder="e.g., Customer Name, Invoice Amount, Date"
                      value={currentField.label}
                      onChange={(e) =>
                        setCurrentField({
                          ...currentField,
                          label: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="field-type">Field Type</Label>
                    <Select
                      value={currentField.type}
                      onValueChange={(value) =>
                        setCurrentField({ ...currentField, type: value })
                      }
                    >
                      <SelectTrigger id="field-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <span className="flex items-center gap-2">
                              <span>{type.icon}</span>
                              <span>{type.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="field-description">
                      AI Extraction Hint
                    </Label>
                    <Textarea
                      id="field-description"
                      placeholder="Tell AI what to look for, e.g., 'Extract the customer's full name from the document'"
                      value={currentField.description}
                      onChange={(e) =>
                        setCurrentField({
                          ...currentField,
                          description: e.target.value,
                        })
                      }
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Be specific to help AI extract accurate data
                    </p>
                  </div>

                  {(currentField.type === "SELECT" ||
                    currentField.type === "MULTISELECT") && (
                    <div className="space-y-2">
                      <Label>Options (comma-separated)</Label>
                      <Input
                        placeholder="e.g., Low, Medium, High, Urgent"
                        value={currentField.options?.join(", ") || ""}
                        onChange={(e) =>
                          setCurrentField({
                            ...currentField,
                            options: e.target.value
                              .split(",")
                              .map((o) => o.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="required">Required Field</Label>
                      <p className="text-xs text-muted-foreground">
                        AI must extract this field
                      </p>
                    </div>
                    <Switch
                      id="required"
                      checked={currentField.required}
                      onCheckedChange={(checked) =>
                        setCurrentField({ ...currentField, required: checked })
                      }
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddField(false);
                        setCurrentField({
                          id: "",
                          name: "",
                          label: "",
                          description: "",
                          type: "TEXT",
                          required: false,
                          options: [],
                        });
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button onClick={addField} className="flex-1">
                      <Plus className="size-4 mr-2" />
                      Add Field
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                <ArrowLeft className="size-4 mr-2" />
                Back
              </Button>
              <Link href="/forms/generate" className="flex-1">
                <Button variant="outline" className="w-full">
                  <Sparkles className="size-4 mr-2" />
                  Use AI Instead
                </Button>
              </Link>
              <Button
                onClick={saveForm}
                disabled={saving || fields.length === 0}
                className="flex-1"
                size="lg"
              >
                <Save className="size-4 mr-2" />
                {saving ? "Saving..." : "Save Form"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
