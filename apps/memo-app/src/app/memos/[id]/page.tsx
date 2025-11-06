"use client";

import { ArrowLeft, FileAudio, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { AudioRecorder } from "@/components/audio-recorder";
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

export default function MemoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [memo, setMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const fetchMemo = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch memo details
      const memoResponse = await fetch(`/api/memos/${id}`);
      if (!memoResponse.ok) {
        throw new Error("Memo not found");
      }
      const memoData = await memoResponse.json();
      setMemo(memoData.data);

      // Fetch attached files
      setLoadingFiles(true);
      const filesResponse = await fetch(`/api/memos/${id}/files`);
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        setAttachedFiles(
          filesData.data.map((file: any) => ({
            id: file.id,
            filename: file.filename,
            size: file.size,
          })),
        );
      }
      setLoadingFiles(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memo");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMemo();
  }, [fetchMemo]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this memo?")) {
      return;
    }

    try {
      setDeleting(true);
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
      setDeleting(false);
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
      setAttachedFiles((prev) => [...prev, { id: fileId, filename, size: 0 }]);

      // Reload files to get the new one
      await fetchMemo();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to attach audio file",
      );
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
            <Badge className={statusColors[memo?.status || "DRAFT"]} variant="default">
              {memo?.status}
            </Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Memo Details</CardTitle>
              <CardDescription>Update your memo information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={memo?.title || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-generated by AI from your recording
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Transcription</Label>
                  <Textarea
                    id="content"
                    value={memo?.content || ""}
                    disabled
                    rows={10}
                    className="resize-y bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-generated transcription from your recording
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <div className="p-2 border rounded-md bg-muted">
                    <Badge className={statusColors[memo?.status || "DRAFT"]} variant="default">
                      {memo?.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Status is automatically managed by the system
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Add More Audio</Label>
                  <AudioRecorder
                    onUploadComplete={handleAudioUpload}
                    onError={(err) => setError(err)}
                  />
                </div>

                {(attachedFiles.length > 0 || loadingFiles) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileAudio className="size-4" />
                        Attached Files{" "}
                        {attachedFiles.length > 0 &&
                          `(${attachedFiles.length})`}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {loadingFiles && !attachedFiles.length ? (
                        <div className="text-sm text-muted-foreground">
                          Loading files...
                        </div>
                      ) : (
                        attachedFiles.map((file) => (
                          <div
                            key={file.id}
                            className="space-y-2 p-3 border rounded-md"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileAudio className="size-4 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                  {file.filename}
                                </span>
                              </div>
                              <a
                                href={`/api/files/${file.id}/download`}
                                download
                                className="text-xs text-primary hover:underline"
                              >
                                Download
                              </a>
                            </div>
                            {file.filename.match(
                              /\.(webm|wav|mp3|ogg|m4a)$/i,
                            ) && (
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
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1"
                  >
                    <Trash2 className="size-4" />
                    {deleting ? "Deleting..." : "Delete Memo"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
