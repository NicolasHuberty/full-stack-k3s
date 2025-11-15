"use client";

import { ArrowLeft, Plus, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MemoStatus } from "@/types";

interface Memo {
  id: string;
  title: string;
  content: string;
  status: MemoStatus;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<MemoStatus, string> = {
  DRAFT: "bg-slate-500",
  PREPARING: "bg-blue-500",
  RUNNING: "bg-yellow-500",
  DONE: "bg-green-500",
  CANCELLED: "bg-gray-500",
  FAILED: "bg-red-500",
  ARCHIVED: "bg-zinc-500",
};

export default function MemosPage() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemoStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);

  const fetchMemos = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }
      if (search) {
        params.append("search", search);
      }

      const response = await fetch(`/api/memos?${params}`);
      const data = await response.json();
      setMemos(data.data || []);
    } catch (error) {
      console.error("Failed to fetch memos:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchMemos();
  }, [fetchMemos]);

  const filteredMemos = memos.filter(
    (memo) =>
      memo.title.toLowerCase().includes(search.toLowerCase()) ||
      memo.content.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Link href="/">
                  <Button variant="ghost" size="icon-sm">
                    <ArrowLeft className="size-4" />
                  </Button>
                </Link>
                <h1 className="text-3xl font-bold tracking-tight">Memos</h1>
              </div>
              <p className="text-muted-foreground">
                Manage and track your memos
              </p>
            </div>
            <Link href="/memos/new">
              <Button>
                <Plus className="size-4" />
                New Memo
              </Button>
            </Link>
          </div>

          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search memos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as MemoStatus | "ALL")
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PREPARING">Preparing</SelectItem>
                <SelectItem value="RUNNING">Running</SelectItem>
                <SelectItem value="DONE">Done</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading memos...
            </div>
          ) : filteredMemos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No memos found. Create your first memo to get started.
                </p>
                <Link href="/memos/new">
                  <Button className="mt-4">
                    <Plus className="size-4" />
                    Create Memo
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredMemos.map((memo) => (
                <Link key={memo.id} href={`/memos/${memo.id}`}>
                  <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg line-clamp-1">
                          {memo.title}
                        </CardTitle>
                        <Badge
                          className={statusColors[memo.status]}
                          variant="default"
                        >
                          {memo.status}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {memo.content}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(memo.updatedAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
