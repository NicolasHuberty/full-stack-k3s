"use client";

import {
  Copy,
  Eye,
  FileText,
  Globe,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Form {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  createdAt: string;
  team?: { id: string; name: string };
  creator: { id: string; name: string; email: string };
  _count: {
    fields: number;
    submissions: number;
  };
}

export default function FormsPage() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);

  const loadForms = useCallback(async () => {
    try {
      const res = await fetch("/api/forms");
      if (res.ok) {
        const { data } = await res.json();
        setForms(data);
      }
    } catch (error) {
      console.error("Load forms error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  const duplicateForm = async (formId: string) => {
    try {
      const res = await fetch(`/api/forms/${formId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        loadForms();
      }
    } catch (error) {
      console.error("Duplicate form error:", error);
    }
  };

  const deleteForm = async (formId: string) => {
    if (!confirm("Are you sure you want to delete this form?")) return;

    try {
      const res = await fetch(`/api/forms/${formId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setForms(forms.filter((f) => f.id !== formId));
      }
    } catch (error) {
      console.error("Delete form error:", error);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Forms</h1>
            <p className="text-muted-foreground mt-1">
              Manage your custom data extraction forms
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/forms/marketplace">
              <Button variant="outline">
                <Globe className="size-4 mr-2" />
                Marketplace
              </Button>
            </Link>
            <Link href="/forms/generate">
              <Button variant="outline">
                <Sparkles className="size-4 mr-2" />
                Generate with AI
              </Button>
            </Link>
            <Link href="/forms/new">
              <Button>
                <Plus className="size-4 mr-2" />
                New Form
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading forms...
          </div>
        ) : forms.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="size-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No forms yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first form to start extracting structured data with
                AI
              </p>
              <Link href="/forms/new">
                <Button>
                  <Plus className="size-4 mr-2" />
                  Create Form
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forms.map((form) => (
              <Card key={form.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{form.name}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">
                        {form.description || "No description"}
                      </CardDescription>
                    </div>
                    {form.isPublic && (
                      <Badge variant="secondary" className="ml-2">
                        <Globe className="size-3 mr-1" />
                        Public
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Fields</span>
                      <span className="font-medium">{form._count.fields}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Uses</span>
                      <span className="font-medium">
                        {form._count.submissions}
                      </span>
                    </div>
                    {form.team && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="size-3" />
                        <span>{form.team.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Link href={`/forms/${form.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Eye className="size-4 mr-2" />
                        View
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => duplicateForm(form.id)}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteForm(form.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
