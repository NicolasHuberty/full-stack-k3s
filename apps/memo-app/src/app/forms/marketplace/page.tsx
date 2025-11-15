"use client";

import { ArrowLeft, Download, FileText, Star, TrendingUp } from "lucide-react";
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

interface MarketplaceForm {
  id: string;
  name: string;
  description?: string;
  category?: string;
  rating: number;
  usageCount: number;
  creator: {
    id: string;
    name: string;
    image?: string;
  };
  _count: {
    fields: number;
    submissions: number;
    reviews: number;
  };
}

export default function FormMarketplacePage() {
  const [forms, setForms] = useState<MarketplaceForm[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMarketplaceForms = useCallback(async () => {
    try {
      const res = await fetch("/api/forms/marketplace");
      if (res.ok) {
        const { data } = await res.json();
        setForms(data);
      }
    } catch (error) {
      console.error("Load marketplace forms error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarketplaceForms();
  }, [loadMarketplaceForms]);

  const importForm = async (formId: string) => {
    try {
      const res = await fetch(`/api/forms/${formId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        alert("Form imported successfully!");
      }
    } catch (error) {
      console.error("Import form error:", error);
      alert("Failed to import form");
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/forms">
              <Button variant="ghost" size="sm" className="mb-2">
                <ArrowLeft className="size-4 mr-2" />
                Back to My Forms
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Form Marketplace</h1>
            <p className="text-muted-foreground mt-1">
              Discover and import form templates created by the community
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading marketplace...
          </div>
        ) : forms.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="size-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No public forms yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Be the first to publish a form to the marketplace!
              </p>
              <Link href="/forms/new">
                <Button>Create & Publish Form</Button>
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
                  </div>
                  {form.category && (
                    <Badge variant="outline" className="w-fit mt-2">
                      {form.category}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Star className="size-4 text-yellow-500 fill-yellow-500" />
                        <span className="font-medium">
                          {form.rating.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground">
                          ({form._count.reviews})
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="size-4" />
                        <span>{form.usageCount} uses</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Fields</span>
                      <span className="font-medium">{form._count.fields}</span>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      By {form.creator.name}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Link href={`/forms/${form.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        Preview
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      onClick={() => importForm(form.id)}
                      className="flex-1"
                    >
                      <Download className="size-4 mr-2" />
                      Import
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
