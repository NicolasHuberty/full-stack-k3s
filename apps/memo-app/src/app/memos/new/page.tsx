"use client";

import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AudioRecorder } from "@/components/audio-recorder";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NewMemoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const handleCreateMemo = async () => {
    if (uploadedFiles.length === 0) {
      setError("Please record or upload at least one audio file");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Create memo with auto-generated title and content
      const response = await fetch("/api/memos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "New Voice Memo", // Temporary title, will be updated by AI
          content: "", // Will be filled with transcription
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create memo");
      }

      const data = await response.json();
      const memoId = data.data.id;

      // Attach uploaded files to the memo
      await fetch(`/api/memos/${memoId}/files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileIds: uploadedFiles.map((f) => f.id),
        }),
      });

      router.push(`/memos/${memoId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create memo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Link href="/memos">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">New Memo</h1>
              <p className="text-muted-foreground">
                Record or upload audio to create a memo
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Record Voice Memo</CardTitle>
              <CardDescription>
                Record or upload audio - AI will generate title and
                transcription
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <AudioRecorder
                  onUploadComplete={(fileId, filename) => {
                    setUploadedFiles((prev) => [
                      ...prev,
                      { id: fileId, name: filename },
                    ]);
                  }}
                  onError={(err) => setError(err)}
                />
                {uploadedFiles.length > 0 && (
                  <div className="text-sm text-green-600 dark:text-green-400">
                    ✓ {uploadedFiles.length} file(s) uploaded successfully
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleCreateMemo}
                  disabled={loading || uploadedFiles.length === 0}
                  className="flex-1"
                >
                  <Save className="size-4" />
                  {loading ? "Creating..." : "Create Memo"}
                </Button>
                <Link href="/memos">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
              {uploadedFiles.length === 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Upload audio files first to create a memo
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
