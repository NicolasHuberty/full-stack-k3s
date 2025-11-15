"use client";

import {
  ArrowLeft,
  Check,
  Clock,
  Download,
  Edit2,
  FileAudio,
  FileText,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MemoStatus } from "@/types";

interface FormFieldOption {
  id: string;
  label: string;
  value: string;
  order: number;
}

interface FormField {
  id: string;
  name: string;
  label: string;
  description: string;
  type: string;
  required: boolean;
  order: number;
  options: FormFieldOption[];
}

interface Form {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
}

interface MemoFormData {
  id: string;
  data: Record<string, any>;
  missingFields: string[];
  validationStatus: string;
  form: Form;
}

interface Memo {
  id: string;
  title: string;
  content: string;
  status: MemoStatus;
  createdAt: string;
  updatedAt: string;
  formId?: string;
  formData?: MemoFormData;
  extractedData?: Record<string, any>;
}

interface AttachedFile {
  id: string;
  filename: string;
  size: number;
  mimeType?: string;
}

const statusConfig: Record<
  MemoStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }
> = {
  DRAFT: { label: "Brouillon", variant: "secondary", icon: Edit2 },
  PREPARING: { label: "Préparation", variant: "outline", icon: Clock },
  RUNNING: { label: "En cours", variant: "default", icon: Loader2 },
  DONE: { label: "Terminé", variant: "default", icon: Check },
  CANCELLED: { label: "Annulé", variant: "secondary", icon: X },
  FAILED: { label: "Échec", variant: "destructive", icon: X },
  ARCHIVED: { label: "Archivé", variant: "outline", icon: Check },
};

export default function MemoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [memo, setMemo] = useState<Memo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isEditingForm, setIsEditingForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const fetchMemo = useCallback(async () => {
    try {
      setLoading(true);
      const memoResponse = await fetch(`/api/memos/${id}`);
      if (!memoResponse.ok) throw new Error("Memo not found");

      const memoData = await memoResponse.json();
      setMemo(memoData.data);
      setTitle(memoData.data.title);
      setContent(memoData.data.content);

      // Initialize form data if exists
      if (memoData.data.formData?.data) {
        setFormData(memoData.data.formData.data);
      }

      const filesResponse = await fetch(`/api/memos/${id}/files`);
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        setAttachedFiles(filesData.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memo");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const checkStatus = useCallback(async () => {
    try {
      const memoResponse = await fetch(`/api/memos/${id}`);
      if (!memoResponse.ok) return;

      const memoData = await memoResponse.json();

      // Only update if status changed or content changed
      if (memoData.data.status !== memo?.status ||
          memoData.data.content !== memo?.content ||
          memoData.data.title !== memo?.title) {
        // Full refresh when processing completes or content updates
        await fetchMemo();
      } else {
        // Just update the memo object without causing a full reload
        setMemo(memoData.data);
      }
    } catch (err) {
      // Silently fail status checks
      console.error("Status check failed:", err);
    }
  }, [id, memo?.status, memo?.content, memo?.title, fetchMemo]);

  useEffect(() => {
    fetchMemo();
  }, [fetchMemo]);

  useEffect(() => {
    // Only auto-refresh when status is RUNNING or PREPARING
    if (!memo) return;

    if (memo.status === "RUNNING" || memo.status === "PREPARING") {
      const interval = setInterval(checkStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [memo?.status, checkStatus]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/memos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      if (!response.ok) throw new Error("Failed to update memo");

      await fetchMemo();
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer ce mémo ?")) return;

    try {
      const response = await fetch(`/api/memos/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete memo");
      router.push("/memos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleDownloadFile = (fileId: string, filename: string) => {
    window.open(`/api/files/${fileId}/download`, "_blank");
  };

  const handleTranscribe = async () => {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/memos/${id}/transcribe`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start transcription");
      }

      await fetchMemo();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start transcription",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRetryProcessing = async () => {
    if (!confirm("Relancer le traitement de ce mémo ?")) return;

    setSaving(true);
    setError("");

    try {
      // Trigger transcription
      const transcribeRes = await fetch(`/api/memos/${id}/transcribe`, {
        method: "POST",
      });

      if (!transcribeRes.ok) {
        const data = await transcribeRes.json();
        throw new Error(data.error || "Failed to start transcription");
      }

      await fetchMemo();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to retry processing",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch(`/api/memos/${id}/export/csv`);
      if (!response.ok) throw new Error("Failed to export CSV");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memo-${id}-form-data.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export CSV");
    }
  };

  const handleExportFormPDF = async () => {
    try {
      const response = await fetch(`/api/memos/${id}/export/form-pdf`);
      if (!response.ok) throw new Error("Failed to export PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memo-${id}-form.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export PDF");
    }
  };

  const handleSaveFormData = async () => {
    if (!memo?.formData?.form) return;

    setSaving(true);
    setError("");

    try {
      // Update form data via extraction endpoint
      const response = await fetch(`/api/memos/${id}/form-data`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: formData }),
      });

      if (!response.ok) throw new Error("Failed to update form data");

      await fetchMemo();
      setIsEditingForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save form data");
    } finally {
      setSaving(false);
    }
  };

  const handleFormFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!memo) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <p className="text-destructive mb-4">Mémo introuvable</p>
              <Link href="/memos">
                <Button>Retour aux mémos</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const StatusIcon = statusConfig[memo.status].icon;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Link href="/memos">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="size-4" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold">{memo.title}</h1>
                  <Badge variant={statusConfig[memo.status].variant}>
                    <StatusIcon className="size-3 mr-1" />
                    {statusConfig[memo.status].label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Créé le {new Date(memo.createdAt).toLocaleString("fr-FR")} •
                  Modifié le {new Date(memo.updatedAt).toLocaleString("fr-FR")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {(memo.status === "DRAFT" || memo.status === "FAILED") && (
                <Button
                  onClick={handleRetryProcessing}
                  disabled={saving}
                  variant="default"
                >
                  {saving ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Clock className="size-4 mr-2" />
                  )}
                  Relancer le traitement
                </Button>
              )}
              {!isEditing && (
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  <Edit2 className="size-4 mr-2" />
                  Modifier
                </Button>
              )}
              <Button onClick={handleDelete} variant="destructive" size="icon">
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
              {error}
            </div>
          )}

          {/* Content */}
          <Card>
            <CardHeader>
              <CardTitle>Contenu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label>Titre</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Titre du mémo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contenu</Label>
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Contenu du mémo"
                      rows={15}
                      className="resize-y font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          <Check className="size-4 mr-2" />
                          Enregistrer
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditing(false);
                        setTitle(memo.title);
                        setContent(memo.content);
                      }}
                      variant="outline"
                    >
                      Annuler
                    </Button>
                  </div>
                </>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {memo.content}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form Data */}
          {memo.formData && memo.formData.form && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{memo.formData.form.name}</CardTitle>
                    <CardDescription>
                      {memo.formData.form.description || "Données extraites par l'IA"}
                      {memo.formData.missingFields.length > 0 && (
                        <span className="text-yellow-600 ml-2">
                          ({memo.formData.missingFields.length} champ(s) manquant(s))
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {!isEditingForm ? (
                      <>
                        <Button
                          onClick={() => setIsEditingForm(true)}
                          variant="outline"
                          size="sm"
                        >
                          <Edit2 className="size-4 mr-2" />
                          Modifier
                        </Button>
                        <Button
                          onClick={handleExportCSV}
                          variant="outline"
                          size="sm"
                        >
                          <FileText className="size-4 mr-2" />
                          CSV
                        </Button>
                        <Button
                          onClick={handleExportFormPDF}
                          variant="outline"
                          size="sm"
                        >
                          <Download className="size-4 mr-2" />
                          PDF
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={handleSaveFormData}
                          disabled={saving}
                          size="sm"
                        >
                          {saving ? (
                            <Loader2 className="size-4 mr-2 animate-spin" />
                          ) : (
                            <Check className="size-4 mr-2" />
                          )}
                          Enregistrer
                        </Button>
                        <Button
                          onClick={() => {
                            setIsEditingForm(false);
                            setFormData(memo.formData!.data);
                          }}
                          variant="outline"
                          size="sm"
                        >
                          Annuler
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {memo.formData.form.fields.map((field) => {
                    const value = isEditingForm ? formData[field.name] : memo.formData!.data[field.name];
                    const isMissing = memo.formData!.missingFields.includes(field.name);

                    return (
                      <div
                        key={field.id}
                        className={`p-4 border rounded-lg ${isMissing ? "bg-yellow-50 border-yellow-300" : ""}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm flex items-center gap-2">
                              {field.label}
                              {field.required && (
                                <span className="text-destructive">*</span>
                              )}
                              {isMissing && (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                  Manquant
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {field.description}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {field.type}
                          </Badge>
                        </div>
                        <div className="mt-2">
                          {isEditingForm ? (
                            // Editable input
                            <>
                              {field.type === "TEXTAREA" ? (
                                <Textarea
                                  value={value || ""}
                                  onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                                  rows={3}
                                  className="w-full"
                                />
                              ) : field.type === "NUMBER" ? (
                                <Input
                                  type="number"
                                  value={value || ""}
                                  onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                                  className="w-full"
                                />
                              ) : field.type === "DATE" ? (
                                <Input
                                  type="date"
                                  value={value ? new Date(value).toISOString().split('T')[0] : ""}
                                  onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                                  className="w-full"
                                />
                              ) : field.type === "BOOLEAN" || field.type === "CHECKBOX" ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!!value}
                                    onChange={(e) => handleFormFieldChange(field.name, e.target.checked)}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-sm">{value ? "Oui" : "Non"}</span>
                                </div>
                              ) : (
                                <Input
                                  type="text"
                                  value={value || ""}
                                  onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                                  className="w-full"
                                />
                              )}
                            </>
                          ) : (
                            // Display value
                            <>
                              {value === null || value === undefined || value === "" ? (
                                <p className="text-sm text-muted-foreground italic">
                                  Non renseigné
                                </p>
                              ) : Array.isArray(value) ? (
                                <div className="flex flex-wrap gap-2">
                                  {value.map((v, idx) => (
                                    <Badge key={idx} variant="outline">
                                      {String(v)}
                                    </Badge>
                                  ))}
                                </div>
                              ) : field.type === "BOOLEAN" || field.type === "CHECKBOX" ? (
                                <Badge variant={value ? "default" : "secondary"}>
                                  {value ? "Oui" : "Non"}
                                </Badge>
                              ) : field.type === "DATE" ? (
                                <p className="text-sm font-mono">
                                  {new Date(value).toLocaleDateString("fr-FR")}
                                </p>
                              ) : field.type === "DATETIME" ? (
                                <p className="text-sm font-mono">
                                  {new Date(value).toLocaleString("fr-FR")}
                                </p>
                              ) : typeof value === "object" ? (
                                <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                                  {JSON.stringify(value, null, 2)}
                                </pre>
                              ) : (
                                <p className="text-sm">{String(value)}</p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attached Files */}
          {attachedFiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Fichiers audio</CardTitle>
                <CardDescription>
                  {attachedFiles.length} fichier(s) attaché(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {attachedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileAudio className="size-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{file.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleDownloadFile(file.id, file.filename)
                        }
                      >
                        Télécharger
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
