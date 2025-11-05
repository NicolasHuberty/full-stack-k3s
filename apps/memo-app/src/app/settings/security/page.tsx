"use client";

import { useState } from "react";
import { enable2FA, disable2FA, verify2FA } from "@/lib/auth-client";
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
import { Shield, ShieldCheck } from "lucide-react";

export default function SecuritySettingsPage() {
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEnable2FA = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await enable2FA();
      if (result.data) {
        setQrCode(result.data.qrCode);
        setSecret(result.data.secret);
        setShowSetup(true);
      }
    } catch (err) {
      setError("Failed to enable 2FA");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await verify2FA({
        code: verificationCode,
      });

      if (result.data) {
        setBackupCodes(result.data.backupCodes || []);
        setTotpEnabled(true);
        setShowSetup(false);
      } else {
        setError("Invalid code. Please try again.");
      }
    } catch (err) {
      setError("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm("Are you sure you want to disable 2FA?")) return;

    setLoading(true);
    setError("");

    try {
      await disable2FA();
      setTotpEnabled(false);
      setShowSetup(false);
      setQrCode("");
      setSecret("");
      setBackupCodes([]);
    } catch (err) {
      setError("Failed to disable 2FA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Security Settings</h1>
          <p className="text-muted-foreground">Manage your account security</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {totpEnabled ? (
                <ShieldCheck className="size-5 text-green-600" />
              ) : (
                <Shield className="size-5 text-muted-foreground" />
              )}
              <CardTitle>Two-Factor Authentication (2FA)</CardTitle>
            </div>
            <CardDescription>
              Add an extra layer of security to your account with TOTP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!totpEnabled && !showSetup && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Two-factor authentication is currently disabled. Enable it to
                  protect your account.
                </p>
                <Button onClick={handleEnable2FA} disabled={loading}>
                  {loading ? "Loading..." : "Enable 2FA"}
                </Button>
              </div>
            )}

            {showSetup && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">Step 1: Scan QR Code</h3>
                  <p className="text-sm text-muted-foreground">
                    Scan this QR code with your authenticator app (Google
                    Authenticator, Authy, etc.)
                  </p>
                  {qrCode && (
                    <div className="border rounded-lg p-4 bg-white inline-block">
                      <img src={qrCode} alt="2FA QR Code" className="size-48" />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Or enter this secret manually:{" "}
                    <code className="bg-muted px-2 py-1 rounded">{secret}</code>
                  </p>
                </div>

                <form onSubmit={handleVerify2FA} className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold">Step 2: Verify</h3>
                    <Label htmlFor="code">
                      Enter 6-digit code from your app
                    </Label>
                    <Input
                      id="code"
                      type="text"
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      maxLength={6}
                      pattern="[0-9]{6}"
                      required
                    />
                  </div>

                  {error && (
                    <div className="text-sm text-destructive">{error}</div>
                  )}

                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Verifying..." : "Verify & Enable"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowSetup(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {totpEnabled && backupCodes.length > 0 && (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                  <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                    2FA is enabled and active
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Backup Codes</h3>
                  <p className="text-sm text-muted-foreground">
                    Save these backup codes in a safe place. You can use them to
                    access your account if you lose your authenticator device.
                  </p>
                  <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-1">
                    {backupCodes.map((code, i) => (
                      <div key={i}>{code}</div>
                    ))}
                  </div>
                </div>

                <Button
                  variant="destructive"
                  onClick={handleDisable2FA}
                  disabled={loading}
                >
                  {loading ? "Disabling..." : "Disable 2FA"}
                </Button>
              </div>
            )}

            {error && !showSetup && (
              <div className="text-sm text-destructive">{error}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
