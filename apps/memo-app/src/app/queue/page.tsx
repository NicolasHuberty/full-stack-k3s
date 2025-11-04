"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Activity, CheckCircle, XCircle, Clock, Loader } from "lucide-react";

interface QueueHealth {
  redis: string;
  queues?: {
    fileUpload: Record<string, number>;
    fileProcess: Record<string, number>;
    fileDelete: Record<string, number>;
  };
  error?: string;
}

export default function QueueDashboard() {
  const [health, setHealth] = useState<QueueHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    try {
      const response = await fetch("/api/queue/health");
      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error("Failed to fetch queue health:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "disconnected":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Activity className="size-8" />
                Queue Dashboard
              </h1>
              <p className="text-muted-foreground">
                Monitor background jobs and task queues
              </p>
            </div>
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader className="size-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Loading queue status...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Redis Status */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Redis Connection</CardTitle>
                    <Badge className={getStatusColor(health?.redis || "disconnected")}>
                      {health?.redis || "Unknown"}
                    </Badge>
                  </div>
                </CardHeader>
                {health?.error && (
                  <CardContent>
                    <p className="text-sm text-destructive">{health.error}</p>
                  </CardContent>
                )}
              </Card>

              {/* Queue Statistics */}
              {health?.queues && (
                <div className="grid gap-6 md:grid-cols-3">
                  {/* File Upload Queue */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">File Upload Queue</CardTitle>
                      <CardDescription>Async file uploads to MinIO</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Clock className="size-4 text-yellow-500" />
                          Waiting
                        </span>
                        <span className="font-mono">{health.queues.fileUpload.waiting || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Loader className="size-4 text-blue-500 animate-spin" />
                          Active
                        </span>
                        <span className="font-mono">{health.queues.fileUpload.active || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="size-4 text-green-500" />
                          Completed
                        </span>
                        <span className="font-mono">{health.queues.fileUpload.completed || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <XCircle className="size-4 text-red-500" />
                          Failed
                        </span>
                        <span className="font-mono">{health.queues.fileUpload.failed || 0}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* File Process Queue */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">File Process Queue</CardTitle>
                      <CardDescription>Audio transcription & analysis</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Clock className="size-4 text-yellow-500" />
                          Waiting
                        </span>
                        <span className="font-mono">{health.queues.fileProcess.waiting || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Loader className="size-4 text-blue-500 animate-spin" />
                          Active
                        </span>
                        <span className="font-mono">{health.queues.fileProcess.active || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="size-4 text-green-500" />
                          Completed
                        </span>
                        <span className="font-mono">{health.queues.fileProcess.completed || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <XCircle className="size-4 text-red-500" />
                          Failed
                        </span>
                        <span className="font-mono">{health.queues.fileProcess.failed || 0}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* File Delete Queue */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">File Delete Queue</CardTitle>
                      <CardDescription>Cleanup & file deletion</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Clock className="size-4 text-yellow-500" />
                          Waiting
                        </span>
                        <span className="font-mono">{health.queues.fileDelete.waiting || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Loader className="size-4 text-blue-500 animate-spin" />
                          Active
                        </span>
                        <span className="font-mono">{health.queues.fileDelete.active || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="size-4 text-green-500" />
                          Completed
                        </span>
                        <span className="font-mono">{health.queues.fileDelete.completed || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <XCircle className="size-4 text-red-500" />
                          Failed
                        </span>
                        <span className="font-mono">{health.queues.fileDelete.failed || 0}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>How to Use</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Async File Upload</h3>
                    <p className="text-sm text-muted-foreground">
                      Use <code className="bg-muted px-1 py-0.5 rounded">POST /api/files/upload-async</code> instead of
                      the synchronous endpoint. Returns a job ID immediately, processing happens in background.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Check Job Status</h3>
                    <p className="text-sm text-muted-foreground">
                      Use <code className="bg-muted px-1 py-0.5 rounded">GET /api/queue/job/[jobId]</code> to check
                      the status and progress of any job.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Start Workers</h3>
                    <p className="text-sm text-muted-foreground">
                      Run <code className="bg-muted px-1 py-0.5 rounded">bun src/workers/index.ts</code> to start
                      processing background jobs.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
