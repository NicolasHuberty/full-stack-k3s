"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, authClient, oneTap } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Chrome, Github, Building2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Initialize Google One Tap (only works if localhost is whitelisted in Google Cloud Console)
  useEffect(() => {
    // Only enable One Tap in production or if you've added localhost to authorized origins
    const isProduction = process.env.NODE_ENV === "production";
    const enableOneTap = process.env.NEXT_PUBLIC_ENABLE_ONE_TAP === "true";

    if (isProduction || enableOneTap) {
      oneTap({
        fetchOptions: {
          onSuccess: () => {
            // Force a hard reload to ensure session is properly loaded
            window.location.href = "/memos";
          },
          onError: (error) => {
            // Silently ignore errors on localhost - Google One Tap can have FedCM issues
            // These are expected when testing locally and don't affect functionality
            console.debug("One Tap initialization (expected on localhost):", error);
          },
        },
      });
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
        callbackURL: "/memos",
      });

      if (result.error) {
        if (result.error.message?.includes("2FA")) {
          setNeeds2FA(true);
          setError("Please enter your 2FA code");
        } else if (
          result.error.message?.includes("verify") ||
          result.error.message?.includes("verification")
        ) {
          setNeedsVerification(true);
          setError(
            "Please verify your email address. Click below to resend verification email.",
          );
        } else {
          setError(result.error.message || "Invalid credentials");
        }
      } else {
        router.push("/memos");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Verify 2FA code
      const result = await signIn.email({
        email,
        password,
        callbackURL: "/memos",
      });

      if (result.error) {
        setError("Invalid 2FA code");
      } else {
        router.push("/memos");
      }
    } catch (err) {
      setError("2FA verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setError("");
    try {
      await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/memos`,
      });
      setError(
        "Verification email sent! Please check your inbox and click the verification link.",
      );
    } catch (err) {
      setError("Failed to send verification email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "github" | "microsoft") => {
    try {
      await signIn.social({
        provider,
        callbackURL: "/memos",
      });
    } catch (err) {
      setError(`Failed to sign in with ${provider}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login to Memo App</CardTitle>
          <CardDescription>
            Enter your credentials to access your memos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!needs2FA ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && <div className="text-sm text-destructive">{error}</div>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>

              {needsVerification && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResendVerification}
                  disabled={loading}
                >
                  Resend Verification Email
                </Button>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuthSignIn("google")}
                  disabled={loading}
                >
                  <Chrome className="mr-2 h-4 w-4" />
                  Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuthSignIn("github")}
                  disabled={loading}
                >
                  <Github className="mr-2 h-4 w-4" />
                  GitHub
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleOAuthSignIn("microsoft")}
                disabled={loading}
              >
                <Building2 className="mr-2 h-4 w-4" />
                Microsoft
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/register" className="text-primary hover:underline">
                  Sign up
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handle2FASubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totpCode">2FA Code</Label>
                <Input
                  id="totpCode"
                  type="text"
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              {error && <div className="text-sm text-destructive">{error}</div>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verifying..." : "Verify & Sign In"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setNeeds2FA(false)}
              >
                Back
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
