"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Trash2, FileAudio } from "lucide-react";
import { AudioRecorder } from "@/components/audio-recorder";
import { MemoStatus } from "@/types";

interface Memo {
  id: string;
  title: string;
  content: string;
  status: MemoStatus;
  createdAt: string;
  updatedAt: string;
}

interface AttachedFile {
  id: string;
  filename: string;
  size: number;
}

const statusColors: Record<MemoStatus, string> = {
  DRAFT: "bg-slate-500",
  PREPARING: "bg-blue-500",
  RUNNING: "bg-yellow-500",
  DONE: "bg-green-500",
  CANCELLED: "bg-gray-500",
  FAILED: "bg-red-500",
  ARCHIVED: "bg-zinc-500",
};

export default function MemoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [memo, setMemo] = useState<Memo | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<MemoStatus>("DRAFT");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  useEffect(() => {
    fetchMemo();
  }, [id]);

  const fetchMemo = async () => {
    try {
      setLoading(true);

      // Fetch memo details
      const memoResponse = await fetch(`/api/memos/${id}`);
      if (!memoResponse.ok) {
        throw new Error("Memo not found");
      }
      const memoData = await memoResponse.json();
      setMemo(memoData.data);
      setTitle(memoData.data.title);
      setContent(memoData.data.content);
      setStatus(memoData.data.status);

      // Fetch attached files
      setLoadingFiles(true);
      const filesResponse = await fetch(`/api/memos/${id}/files`);
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        setAttachedFiles(filesData.data.map((file: any) => ({
          id: file.id,
          filename: file.filename,
          size: file.size,
        })));
      }
      setLoadingFiles(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memo");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const oldStatus = memo?.status;
    const isChangingToRunning = status === "RUNNING" && oldStatus !== "RUNNING";

    try {
      const response = await fetch(`/api/memos/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
          status,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update memo");
      }

      const data = await response.json();
      setMemo(data.data);

      // Show message if changing to RUNNING with audio files
      if (isChangingToRunning && attachedFiles.some(f => f.filename.match(/\.(webm|wav|mp3|ogg|m4a)$/i))) {
        alert("Memo set to RUNNING! Audio transcription jobs have been queued automatically. Check the Queue Dashboard to monitor progress.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update memo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this memo?")) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/memos/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete memo");
      }

      router.push("/memos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete memo");
      setSaving(false);
    }
  };

  const handleAudioUpload = async (fileId: string, filename: string) => {
    try {
      // Attach the uploaded audio file to the memo
      const response = await fetch(`/api/memos/${id}/files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileIds: [fileId],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to attach file");
      }

      // Add to attached files list
      setAttachedFiles(prev => [...prev, { id: fileId, filename, size: 0 }]);

      // Reload files to get the new one
      await fetchMemo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach audio file");
    }
  };

  const handleTranscribeAll = async () => {
    if (!confirm("Transcribe all audio files attached to this memo?")) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/memos/${id}/transcribe`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to queue transcriptions");
      }

      const data = await response.json();
      alert(`Queued ${data.jobs?.length || 0} transcription job(s). Check the Queue Dashboard for status.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transcribe files");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading memo...</div>
      </div>
    );
  }

  if (error && !memo) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-destructive mb-4">{error}</p>
                <Link href="/memos">
                  <Button>Back to Memos</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/memos">
                <Button variant="ghost" size="icon-sm">
                  <ArrowLeft className="size-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Edit Memo</h1>
                <p className="text-sm text-muted-foreground">
                  Created {memo && new Date(memo.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            <Badge className={statusColors[status]} variant="default">
              {status}
            </Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Memo Details</CardTitle>
              <CardDescription>
                Update your memo information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter memo title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={255}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    placeholder="Enter memo content..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                    rows={10}
                    className="resize-y"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={status}
                    onValueChange={(value) => setStatus(value as MemoStatus)}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="PREPARING">Preparing</SelectItem>
                      <SelectItem value="RUNNING">Running (Auto-transcribe audio)</SelectItem>
                      <SelectItem value="DONE">Done</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  {status === "RUNNING" && attachedFiles.some(f => f.filename.match(/\.(webm|wav|mp3|ogg|m4a)$/i)) && (
                    <p className="text-xs text-muted-foreground">
                      Setting to RUNNING will automatically transcribe all audio files
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Audio Recording</Label>
                  <AudioRecorder
                    onUploadComplete={handleAudioUpload}
                    onError={(err) => setError(err)}
                  />
                </div>

                {(attachedFiles.length > 0 || loadingFiles) && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileAudio className="size-4" />
                        Attached Files {attachedFiles.length > 0 && `(${attachedFiles.length})`}
                      </CardTitle>
                      {attachedFiles.some(f => f.filename.match(/\.(webm|wav|mp3|ogg|m4a)$/i)) && (
                        <Button
                          onClick={handleTranscribeAll}
                          variant="outline"
                          size="sm"
                          disabled={saving}
                        >
                          Transcribe All
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {loadingFiles && !attachedFiles.length ? (
                        <div className="text-sm text-muted-foreground">Loading files...</div>
                      ) : (
                        attachedFiles.map((file) => (
                        <div key={file.id} className="space-y-2 p-3 border rounded-md">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileAudio className="size-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{file.filename}</span>
                            </div>
                            <a
                              href={`/api/files/${file.id}/download`}
                              download
                              className="text-xs text-primary hover:underline"
                            >
                              Download
                            </a>
                          </div>
                          {file.filename.match(/\.(webm|wav|mp3|ogg|m4a)$/i) && (
                            <audio
                              controls
                              src={`/api/files/${file.id}/download`}
                              className="w-full"
                            />
                          )}
                        </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                )}

                {error && (
                  <div className="p-3 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving} className="flex-1">
                    <Save className="size-4" />
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
