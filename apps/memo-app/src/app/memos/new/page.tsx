"use client";

import { ArrowLeft, Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Form {
  id: string;
  name: string;
  description?: string;
  _count: {
    fields: number;
  };
}

export default function NewMemoPage() {
  const router = useRouter();
  const [selectedFormId, setSelectedFormId] = useState<string>("none");
  const [forms, setForms] = useState<Form[]>([]);
  const [error, setError] = useState("");

  // Input mode
  const [inputMode, setInputMode] = useState<"audio" | "text">("audio");
  const [textContent, setTextContent] = useState("");

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const loadForms = useCallback(async () => {
    try {
      const res = await fetch("/api/forms");
      if (res.ok) {
        const { data } = await res.json();
        setForms(data);
      }
    } catch (error) {
      console.error("Load forms error:", error);
    }
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      setError("Failed to access microphone. Please check permissions.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    chunksRef.current = [];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSave = async () => {
    // Validate input
    if (inputMode === "audio") {
      if (!audioBlob) {
        setError("Please record audio first");
        return;
      }
      if (audioBlob.size < 1000) {
        setError("Recording too short. Please record again.");
        return;
      }
    } else {
      if (!textContent.trim()) {
        setError("Please enter some text");
        return;
      }
    }

    setIsProcessing(true);
    setError("");

    try {
      // Generate default title
      const now = new Date();
      const dateStr = now.toLocaleDateString("fr-FR");
      const memoCount = await getMemoCount();
      const defaultTitle = `Memo #${memoCount + 1} du ${dateStr}`;

      let fileId: string | undefined;

      // Upload audio file if in audio mode
      if (inputMode === "audio" && audioBlob) {
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.webm");

        const uploadRes = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const uploadError = await uploadRes.json();
          throw new Error(uploadError.error || "Failed to upload audio");
        }

        const uploadData = await uploadRes.json();
        fileId = uploadData.data?.fileId;

        if (!fileId) {
          throw new Error("Upload succeeded but no file ID returned");
        }
      }

      // Create memo
      const memoRes = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: defaultTitle,
          content:
            inputMode === "text"
              ? textContent
              : "Processing audio transcription...",
          formId:
            selectedFormId && selectedFormId !== "none"
              ? selectedFormId
              : undefined,
        }),
      });

      if (!memoRes.ok) {
        throw new Error("Failed to create memo");
      }

      const { data: memo } = await memoRes.json();

      // Attach audio file if uploaded
      if (fileId) {
        const attachRes = await fetch(`/api/memos/${memo.id}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileIds: [fileId] }),
        });

        if (!attachRes.ok) {
          const attachError = await attachRes.json();
          console.error("Failed to attach file:", attachError);
          throw new Error(
            attachError.error || "Failed to attach audio file to memo",
          );
        }

        // Start transcription for audio (non-blocking, just log errors)
        const transcribeRes = await fetch(`/api/memos/${memo.id}/transcribe`, {
          method: "POST",
        });

        if (!transcribeRes.ok) {
          try {
            const transcribeError = await transcribeRes.json();
            console.error("Failed to start transcription:", transcribeError);
          } catch (jsonError) {
            console.error("Failed to parse transcription error response");
          }
        }
      } else {
        // For text input, trigger AI processing directly
        const processRes = await fetch(`/api/memos/${memo.id}/process`, {
          method: "POST",
        });

        if (!processRes.ok) {
          console.error("Failed to start AI processing");
        }
      }

      // If form selected, trigger extraction
      if (selectedFormId && selectedFormId !== "none") {
        try {
          const extractRes = await fetch(`/api/memos/${memo.id}/extract`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ formId: selectedFormId }),
          });

          if (!extractRes.ok) {
            console.log(
              "Extraction will be performed after processing completes",
            );
          }
        } catch (error) {
          console.log(
            "Extraction will be performed after processing completes",
          );
        }
      }

      router.push(`/memos/${memo.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save memo");
      setIsProcessing(false);
    }
  };

  const getMemoCount = async (): Promise<number> => {
    try {
      const res = await fetch("/api/memos");
      if (res.ok) {
        const { data } = await res.json();
        return data.length;
      }
    } catch (error) {
      console.error("Failed to get memo count:", error);
    }
    return 0;
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Link href="/memos">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Nouveau Mémo
              </h1>
              <p className="text-muted-foreground">
                Enregistrez votre audio et l'IA fera le reste
              </p>
            </div>
          </div>

          {/* Form Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Extraction de données (optionnel)</CardTitle>
              <CardDescription>
                Choisissez un formulaire pour extraire automatiquement des
                données structurées
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Formulaire</Label>
                <Select
                  value={selectedFormId}
                  onValueChange={setSelectedFormId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun formulaire" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun formulaire</SelectItem>
                    {forms.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name} ({form._count.fields} champs)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Input Mode Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Mode de saisie</CardTitle>
              <CardDescription>
                Choisissez comment vous voulez créer votre mémo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant={inputMode === "audio" ? "default" : "outline"}
                  onClick={() => setInputMode("audio")}
                  className="flex-1"
                >
                  <Mic className="size-4 mr-2" />
                  Audio
                </Button>
                <Button
                  variant={inputMode === "text" ? "default" : "outline"}
                  onClick={() => setInputMode("text")}
                  className="flex-1"
                >
                  Texte
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Text Input */}
          {inputMode === "text" && (
            <Card>
              <CardHeader>
                <CardTitle>Saisie texte</CardTitle>
                <CardDescription>
                  Entrez le contenu de votre mémo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Écrivez le contenu de votre mémo ici..."
                  rows={15}
                  className="resize-y"
                />
                {error && (
                  <div className="p-3 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm">
                    {error}
                  </div>
                )}
                <Button
                  onClick={handleSave}
                  disabled={isProcessing || !textContent.trim()}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing
                    ? "Traitement en cours..."
                    : "Enregistrer le mémo"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Recording Interface */}
          {inputMode === "audio" && (
            <Card>
              <CardHeader>
                <CardTitle>Enregistrement audio</CardTitle>
                <CardDescription>
                  Cliquez sur le micro pour commencer l'enregistrement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Recording Timer */}
                {(isRecording || audioBlob) && (
                  <div className="text-center">
                    <div className="text-5xl font-bold tabular-nums">
                      {formatTime(recordingTime)}
                    </div>
                    {isRecording && (
                      <div className="text-sm text-muted-foreground mt-2">
                        {isPaused ? "En pause" : "Enregistrement en cours..."}
                      </div>
                    )}
                    {audioBlob && (
                      <div className="text-sm text-muted-foreground mt-2">
                        Enregistrement terminé
                      </div>
                    )}
                  </div>
                )}

                {/* Recording Controls */}
                <div className="flex items-center justify-center gap-4">
                  {!isRecording && !audioBlob && (
                    <Button
                      size="lg"
                      onClick={startRecording}
                      className="size-20 rounded-full"
                    >
                      <Mic className="size-8" />
                    </Button>
                  )}

                  {isRecording && (
                    <>
                      {!isPaused ? (
                        <Button
                          size="lg"
                          variant="outline"
                          onClick={pauseRecording}
                          className="size-16 rounded-full"
                        >
                          <Pause className="size-6" />
                        </Button>
                      ) : (
                        <Button
                          size="lg"
                          variant="outline"
                          onClick={resumeRecording}
                          className="size-16 rounded-full"
                        >
                          <Play className="size-6" />
                        </Button>
                      )}
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={stopRecording}
                        className="size-16 rounded-full"
                      >
                        <Square className="size-6" />
                      </Button>
                    </>
                  )}

                  {audioBlob && !isRecording && (
                    <>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={deleteRecording}
                        className="size-16 rounded-full"
                      >
                        <Trash2 className="size-6" />
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={startRecording}
                        className="size-16 rounded-full"
                      >
                        <Mic className="size-6" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Audio Player */}
                {audioBlob && (
                  <div className="border rounded-lg p-4">
                    <audio
                      controls
                      className="w-full"
                      src={URL.createObjectURL(audioBlob)}
                    />
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm">
                    {error}
                  </div>
                )}

                {/* Save Button */}
                {audioBlob && (
                  <Button
                    onClick={handleSave}
                    disabled={isProcessing}
                    className="w-full"
                    size="lg"
                  >
                    {isProcessing
                      ? "Traitement en cours..."
                      : "Enregistrer le mémo"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
