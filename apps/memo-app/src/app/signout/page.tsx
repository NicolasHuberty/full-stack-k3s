"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SignOutPage() {
  const router = useRouter();

  useEffect(() => {
    async function signOut() {
      try {
        // Call better-auth signout endpoint
        await fetch("/api/auth/sign-out", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        // Redirect to login page
        router.push("/auth/login");
      } catch (error) {
        console.error("Sign out error:", error);
        // Even if there's an error, redirect to login
        router.push("/auth/login");
      }
    }

    signOut();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">Déconnexion en cours...</p>
      </div>
    </div>
  );
}
