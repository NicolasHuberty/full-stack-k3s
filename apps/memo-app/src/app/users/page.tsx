import { ArrowLeft, Users as UsersIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function UsersPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Users</h1>
              <p className="text-muted-foreground">User management</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="size-5" />
                Authentication Not Yet Implemented
              </CardTitle>
              <CardDescription>
                User authentication is coming soon
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                For now, you can create memos without authentication. All memos
                are associated with a default demo user.
              </p>
              <p className="text-sm text-muted-foreground">Future features:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-primary" />
                  User registration and login
                </li>
                <li className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-primary" />
                  Password hashing with bcrypt
                </li>
                <li className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-primary" />
                  Session management
                </li>
                <li className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-primary" />
                  User profiles and settings
                </li>
              </ul>
              <div className="pt-4">
                <Link href="/memos">
                  <Button>Back to Memos</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
