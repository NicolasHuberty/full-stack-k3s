"use client";

import { Mic, Square, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AudioRecorderProps {
  onUploadComplete?: (fileId: string, filename: string) => void;
  onError?: (error: string) => void;
}

export function AudioRecorder({
  onUploadComplete,
  onError,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Media recording is not supported. Please use HTTPS or enable microphone permissions.",
        );
      }

      console.log("[AudioRecorder] Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[AudioRecorder] Microphone access granted");

      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        throw new Error("MediaRecorder is not supported in this browser");
      }

      // Try to determine best mime type
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        }
      }
      console.log(`[AudioRecorder] Using mime type: ${mimeType}`);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(
            `[AudioRecorder] Data chunk received: ${event.data.size} bytes`,
          );
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log(
          `[AudioRecorder] Recording stopped. Total chunks: ${chunksRef.current.length}`,
        );
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log(`[AudioRecorder] Created blob: ${blob.size} bytes`);
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.onerror = (event: any) => {
        console.error("[AudioRecorder] MediaRecorder error:", event.error);
        onError?.(`Recording error: ${event.error?.message || "Unknown error"}`);
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);
      console.log("[AudioRecorder] Recording started");

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("[AudioRecorder] Error starting recording:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to start recording. Please check microphone permissions.";
      onError?.(errorMessage);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const uploadRecording = async () => {
    if (!audioBlob) return;

    try {
      setUploading(true);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      // Determine file extension based on blob type
      const mimeType = audioBlob.type;
      let extension = "webm";
      if (mimeType.includes("mp4")) extension = "mp4";
      else if (mimeType.includes("ogg")) extension = "ogg";
      else if (mimeType.includes("wav")) extension = "wav";
      else if (mimeType.includes("mp3") || mimeType.includes("mpeg"))
        extension = "mp3";

      const filename = `recording-${timestamp}.${extension}`;
      console.log(
        `[AudioRecorder] Uploading file: ${filename} (${audioBlob.size} bytes)`,
      );

      const formData = new FormData();
      formData.append("file", audioBlob, filename);

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await response.json();
      console.log("[AudioRecorder] Upload successful:", data.data);
      onUploadComplete?.(data.data.fileId, data.data.filename);

      // Clear the recording after successful upload
      clearRecording();
    } catch (err) {
      console.error("[AudioRecorder] Upload error:", err);
      onError?.(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const clearRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleFileSelect = (file: File) => {
    // Validate file type
    const validTypes = [
      "audio/webm",
      "audio/wav",
      "audio/mp3",
      "audio/mpeg",
      "audio/m4a",
      "audio/x-m4a",
      "image/webp",
    ];
    if (
      !validTypes.includes(file.type) &&
      !file.name.match(/\.(webm|wav|mp3|m4a|webp)$/i)
    ) {
      onError?.(
        "Invalid file type. Please upload webm, wav, mp3, m4a, or webp files.",
      );
      return;
    }

    setAudioBlob(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic
              className={`size-5 ${isRecording ? "text-red-500 animate-pulse" : "text-muted-foreground"}`}
            />
            <span className="font-medium">
              {isRecording
                ? "Recording..."
                : audioBlob
                  ? "Recording Ready"
                  : "Audio Recorder"}
            </span>
          </div>
          {(isRecording || audioBlob) && (
            <span className="text-sm font-mono text-muted-foreground">
              {formatTime(recordingTime)}
            </span>
          )}
        </div>

        {!isRecording && !audioBlob && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag and drop audio files here
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports: webm, wav, mp3, m4a, webp
            </p>
          </div>
        )}

        {audioUrl && <audio controls src={audioUrl} className="w-full" />}

        <div className="flex gap-2">
          {!isRecording && !audioBlob && (
            <>
              <Button onClick={startRecording} className="flex-1">
                <Mic className="size-4" />
                Start Recording
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1"
              >
                <Upload className="size-4" />
                Upload File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/webm,audio/wav,audio/mp3,audio/mpeg,audio/m4a,audio/x-m4a,image/webp,.webm,.wav,.mp3,.m4a,.webp"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </>
          )}

          {isRecording && (
            <Button
              onClick={stopRecording}
              variant="destructive"
              className="flex-1"
            >
              <Square className="size-4" />
              Stop Recording
            </Button>
          )}

          {audioBlob && !isRecording && (
            <>
              <Button
                onClick={uploadRecording}
                disabled={uploading}
                className="flex-1"
              >
                <Upload className="size-4" />
                {uploading ? "Uploading..." : "Upload to S3"}
              </Button>
              <Button
                onClick={clearRecording}
                variant="outline"
                disabled={uploading}
              >
                <Trash2 className="size-4" />
                Clear
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
