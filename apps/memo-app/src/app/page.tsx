"use client";

import {
  ArrowRight,
  FileText,
  FolderKanban,
  Mic,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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

interface Stats {
  totalMemos: number;
  totalForms: number;
  processingMemos: number;
}

export default function Home() {
  const [stats, setStats] = useState<Stats>({
    totalMemos: 0,
    totalForms: 0,
    processingMemos: 0,
  });
  const [recentMemos, setRecentMemos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch memos
        const memosRes = await fetch("/api/memos");
        if (memosRes.ok) {
          const { data } = await memosRes.json();
          setStats((prev) => ({
            ...prev,
            totalMemos: data.length,
            processingMemos: data.filter(
              (m: any) => m.status === "RUNNING" || m.status === "PREPARING"
            ).length,
          }));
          setRecentMemos(data.slice(0, 5));
        }

        // Fetch forms
        const formsRes = await fetch("/api/forms");
        if (formsRes.ok) {
          const { data } = await formsRes.json();
          setStats((prev) => ({ ...prev, totalForms: data.length }));
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Bienvenue sur Memo App
          </h1>
          <p className="text-muted-foreground">
            Gérez vos mémos avec l'IA et l'extraction de données structurées
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Link href="/memos/new">
            <Button size="lg" className="gap-2">
              <Plus className="size-5" />
              Nouveau Mémo
            </Button>
          </Link>
          <Link href="/forms/new">
            <Button size="lg" variant="outline" className="gap-2">
              <FolderKanban className="size-5" />
              Créer un Formulaire
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Mémos Totaux
              </CardTitle>
              <FileText className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMemos}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Tous vos mémos enregistrés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                En Traitement
              </CardTitle>
              <TrendingUp className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.processingMemos}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Mémos en cours de traitement IA
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Formulaires
              </CardTitle>
              <FolderKanban className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalForms}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Formulaires d'extraction de données
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Memos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Mémos Récents</CardTitle>
                <CardDescription>
                  Vos derniers mémos créés
                </CardDescription>
              </div>
              <Link href="/memos">
                <Button variant="ghost" size="sm" className="gap-2">
                  Voir tout
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Chargement...
              </div>
            ) : recentMemos.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <FileText className="size-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  Aucun mémo pour le moment
                </p>
                <Link href="/memos/new">
                  <Button className="gap-2">
                    <Plus className="size-4" />
                    Créer votre premier mémo
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentMemos.map((memo) => (
                  <Link key={memo.id} href={`/memos/${memo.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <FileText className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{memo.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(memo.createdAt).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          memo.status === "DONE"
                            ? "default"
                            : memo.status === "RUNNING"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {memo.status === "DONE"
                          ? "Terminé"
                          : memo.status === "RUNNING"
                            ? "En cours"
                            : memo.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                Extraction IA
              </CardTitle>
              <CardDescription>
                Créez des formulaires personnalisés et laissez l'IA extraire
                automatiquement les données structurées de vos mémos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/forms">
                <Button variant="secondary" className="gap-2">
                  Explorer les Formulaires
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="size-5 text-blue-500" />
                Audio → Texte
              </CardTitle>
              <CardDescription>
                Enregistrez des mémos vocaux et laissez l'IA les transcrire
                et les structurer automatiquement en documents professionnels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/memos/new">
                <Button variant="secondary" className="gap-2">
                  Enregistrer un Audio
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
