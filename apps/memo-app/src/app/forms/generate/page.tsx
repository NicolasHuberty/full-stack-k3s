"use client";

import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { VoiceInput } from "@/components/voice-input";

export default function GenerateFormPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleVoiceTranscript = (text: string) => {
    setPrompt(text);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please describe the form you want to create");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/forms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate form");
      }

      const { data: form } = await res.json();
      router.push(`/forms/${form.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate form");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <Link href="/forms">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="size-4 mr-2" />
              Back to Forms
            </Button>
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="size-8 text-primary" />
            Generate Form with AI
          </h1>
          <p className="text-muted-foreground mt-2">
            Describe what data you want to extract, and AI will create a custom
            form for you
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Describe Your Form</CardTitle>
            <CardDescription>
              Tell the AI what information you need to extract from your memos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt">Form Description</Label>
                <VoiceInput onTranscript={handleVoiceTranscript} />
              </div>
              <Textarea
                id="prompt"
                placeholder="Example: Create a form to extract customer feedback information including name, email, rating (1-5 stars), feedback category (bug, feature request, general), and detailed comments"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                className="resize-none"
              />
            </div>

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                {error}
              </div>
            )}

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h3 className="font-medium text-sm">Tips for better results:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Be specific about field names and their purpose</li>
                <li>• Mention data types (text, number, date, email, etc.)</li>
                <li>• Specify if fields are required or optional</li>
                <li>• List options for dropdown/select fields</li>
                <li>• Describe what each field should extract</li>
              </ul>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full"
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Generating Form...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  Generate Form
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-6 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="text-lg">Example Prompts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              type="button"
              onClick={() =>
                setPrompt(
                  "Create a form for customer support tickets with: customer name, email, priority (low, medium, high, urgent), category (technical, billing, feature request, other), and issue description",
                )
              }
              className="w-full text-left p-3 rounded-lg hover:bg-background/50 transition-colors text-sm"
            >
              <strong>Customer Support Ticket</strong>
              <p className="text-muted-foreground text-xs mt-1">
                Track support requests with priority and categorization
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                setPrompt(
                  "Create a form for invoice processing with: invoice number, vendor name, invoice date, due date, amount (number), currency (USD, EUR, GBP), payment status (pending, paid, overdue), and notes",
                )
              }
              className="w-full text-left p-3 rounded-lg hover:bg-background/50 transition-colors text-sm"
            >
              <strong>Invoice Processing</strong>
              <p className="text-muted-foreground text-xs mt-1">
                Extract structured data from invoices automatically
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                setPrompt(
                  "Create a form for meeting notes with: meeting title, date, attendees (comma-separated list), agenda items, action items, decisions made, and next meeting date",
                )
              }
              className="w-full text-left p-3 rounded-lg hover:bg-background/50 transition-colors text-sm"
            >
              <strong>Meeting Notes</strong>
              <p className="text-muted-foreground text-xs mt-1">
                Structure meeting information for easy reference
              </p>
            </button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
