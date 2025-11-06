"use client";

import { ArrowLeft, FileAudio, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const statusDescriptions: Record<MemoStatus, string> = {
  DRAFT: "Ready to process - click 'Start Processing' below",
  PREPARING: "Preparing transcription job...",
  RUNNING: "AI is transcribing your audio...",
  DONE: "Transcription complete!",
  CANCELLED: "Processing was cancelled",
  FAILED: "Processing failed - please try again",
  ARCHIVED: "This memo has been archived",
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
  const [processing, setProcessing] = useState(false);
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

    // Auto-refresh if memo is being processed
    const interval = setInterval(() => {
      if (memo?.status === "PREPARING" || memo?.status === "RUNNING") {
        fetchMemo();
      }
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [fetchMemo, memo?.status]);

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

  const handleStartProcessing = async () => {
    try {
      setProcessing(true);
      setError("");

      const response = await fetch(`/api/memos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RUNNING" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start processing");
      }

      await fetchMemo();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start processing",
      );
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading memo...
        </div>
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

  const isProcessing =
    memo?.status === "PREPARING" || memo?.status === "RUNNING";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/memos">
                <Button variant="ghost" size="icon-sm">
                  <ArrowLeft className="size-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {memo?.status === "DRAFT" ? "Review Memo" : memo?.title}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Created {memo && new Date(memo.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            <Badge
              className={statusColors[memo?.status || "DRAFT"]}
              variant="default"
            >
              {memo?.status}
            </Badge>
          </div>

          {/* Status Alert */}
          {memo?.status && (
            <Card
              className={
                memo.status === "DONE"
                  ? "border-green-500/50"
                  : isProcessing
                    ? "border-yellow-500/50"
                    : memo.status === "FAILED"
                      ? "border-red-500/50"
                      : ""
              }
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  {isProcessing && (
                    <Loader2 className="size-5 animate-spin text-yellow-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        memo.status === "DONE"
                          ? "text-green-700 dark:text-green-400"
                          : isProcessing
                            ? "text-yellow-700 dark:text-yellow-400"
                            : ""
                      }`}
                    >
                      {statusDescriptions[memo.status]}
                    </p>
                    {isProcessing && (
                      <p className="text-xs text-muted-foreground mt-1">
                        This page refreshes automatically every 3 seconds
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transcription Content */}
          {memo?.status !== "DRAFT" && (
            <Card>
              <CardHeader>
                <CardTitle>Transcription</CardTitle>
                <CardDescription>
                  {memo?.status === "DONE"
                    ? "AI-generated transcription from your audio"
                    : "Transcription will appear here once processing is complete"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={memo?.content || ""}
                  disabled
                  rows={12}
                  className="resize-none bg-muted font-mono text-sm"
                  placeholder={
                    isProcessing ? "Processing..." : "No content yet"
                  }
                />
              </CardContent>
            </Card>
          )}

          {/* Attached Files */}
          {(attachedFiles.length > 0 || loadingFiles) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileAudio className="size-4" />
                  Audio Files{" "}
                  {attachedFiles.length > 0 && `(${attachedFiles.length})`}
                </CardTitle>
                <CardDescription>
                  Your uploaded audio recordings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingFiles && !attachedFiles.length ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Loading files...
                  </div>
                ) : (
                  attachedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="space-y-2 p-4 border rounded-lg bg-muted/50"
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

          {/* Actions */}
          <div className="flex gap-3">
            {memo?.status === "DRAFT" ? (
              <>
                <Button
                  onClick={handleStartProcessing}
                  disabled={processing || attachedFiles.length === 0}
                  className="flex-1"
                  size="lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    "Start Processing"
                  )}
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={deleting}
                  variant="outline"
                  size="lg"
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </>
            ) : (
              <>
                <Link href="/memos" className="flex-1">
                  <Button variant="default" className="w-full" size="lg">
                    <ArrowLeft className="size-4" />
                    Back to Memos
                  </Button>
                </Link>
                <Button
                  onClick={handleDelete}
                  disabled={deleting || isProcessing}
                  variant="outline"
                  size="lg"
                >
                  <Trash2 className="size-4" />
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
