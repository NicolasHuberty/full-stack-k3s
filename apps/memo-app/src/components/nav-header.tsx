"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { User, LogOut, Shield } from "lucide-react";

export function NavHeader() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/memos" className="text-xl font-bold">
          Memo App
        </Link>

        <nav className="flex items-center gap-4">
          {isPending ? (
            <div className="h-9 w-20 animate-pulse bg-muted rounded" />
          ) : session?.user ? (
            <>
              <span className="text-sm text-muted-foreground">
                {session.user.name || session.user.email}
              </span>
              <Link href="/settings/security">
                <Button variant="ghost" size="sm">
                  <Shield className="size-4 mr-2" />
                  Security
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="size-4 mr-2" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Sign Up</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
