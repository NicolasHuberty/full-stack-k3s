"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
}

export function VoiceInput({ onTranscript }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: "audio/webm",
        });
        stream.getTracks().forEach((track) => track.stop());
        await processAudio(audioBlob);
      };

      // Request data every 100ms to ensure we capture audio
      mediaRecorder.start(100);
      startTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Failed to access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    const duration = Date.now() - startTimeRef.current;

    if (duration < 1000) {
      alert("Recording too short. Please speak for at least 1 second.");
      return;
    }

    if (audioBlob.size < 1000) {
      alert("Audio file too small. Please record again and speak clearly.");
      return;
    }

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Transcription failed");
      }

      const { text } = await response.json();
      if (!text?.trim()) {
        throw new Error("No speech detected. Please try again.");
      }
      onTranscript(text);
    } catch (error) {
      console.error("Error processing audio:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to transcribe audio. Please try again.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!isRecording && !isProcessing && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={startRecording}
          className="gap-2"
        >
          <Mic className="size-4" />
          Voice Input
        </Button>
      )}

      {isRecording && (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={stopRecording}
          className="gap-2 animate-pulse"
        >
          <Square className="size-4 fill-current" />
          Stop Recording
        </Button>
      )}

      {isProcessing && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          className="gap-2"
        >
          <Loader2 className="size-4 animate-spin" />
          Transcribing...
        </Button>
      )}
    </div>
  );
}
