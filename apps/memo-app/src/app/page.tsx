import { Activity, FileText, Plus, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">Memo App</h1>
            <p className="text-lg text-muted-foreground">
              Manage your memos with status tracking and file attachments
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-5" />
                  Memos
                </CardTitle>
                <CardDescription>
                  View, create, and manage your memos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/memos">
                  <Button className="w-full" variant="default">
                    View All Memos
                  </Button>
                </Link>
                <Link href="/memos/new">
                  <Button className="w-full" variant="outline">
                    <Plus className="size-4" />
                    Create New Memo
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  Users
                </CardTitle>
                <CardDescription>
                  Manage user accounts and authentication
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/users">
                  <Button className="w-full" variant="outline">
                    View Users
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="size-5" />
                  Queue Dashboard
                </CardTitle>
                <CardDescription>
                  Monitor background jobs and task queues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/queue">
                  <Button className="w-full" variant="outline">
                    View Queue Status
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-primary" />
                  Create and manage memos with titles and content
                </li>
                <li className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-primary" />
                  Track memo status: Draft, Preparing, Running, Done, Cancelled,
                  Failed, Archived
                </li>
                <li className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-primary" />
                  Attach files to memos with MinIO storage
                </li>
                <li className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-primary" />
                  Filter and search memos
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
