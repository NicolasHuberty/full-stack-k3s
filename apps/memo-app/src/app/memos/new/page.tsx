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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewMemoPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/memos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
          // userId is optional, will use default user if not provided
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create memo");
      }

      const data = await response.json();
      const memoId = data.data.id;

      // Attach uploaded files to the memo
      if (uploadedFiles.length > 0) {
        await fetch(`/api/memos/${memoId}/files`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileIds: uploadedFiles.map((f) => f.id),
          }),
        });
      }

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
              <p className="text-muted-foreground">Create a new memo</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Memo Details</CardTitle>
              <CardDescription>
                Fill in the information below to create a new memo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <Label>Audio Recording</Label>
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
                    <div className="text-sm text-muted-foreground">
                      {uploadedFiles.length} file(s) ready to attach
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-3 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" disabled={loading} className="flex-1">
                    <Save className="size-4" />
                    {loading ? "Creating..." : "Create Memo"}
                  </Button>
                  <Link href="/memos">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
