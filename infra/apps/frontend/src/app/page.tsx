"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Rocket, Server, Users, Activity, ExternalLink } from "lucide-react";

interface HealthData {
  status: string;
  version: string;
  environment: string;
  timestamp: string;
}

interface User {
  id: number;
  name: string;
  email: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message: string;
}

export default function Home() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || "development";

  useEffect(() => {
    fetchHealth();
    fetchUsers();
  }, []);

  const fetchHealth = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/health`);
      const data = await response.json();
      setHealth(data);
    } catch (err) {
      setError("Failed to connect to backend API");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/users`);
      const data: ApiResponse<User[]> = await response.json();
      if (data.success && data.data) {
        setUsers(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Rocket className="w-12 h-12 text-purple-400" />
            <h1 className="text-5xl font-bold text-white">K3s GitOps Demo</h1>
          </div>
          <p className="text-xl text-slate-300 mb-4">
            Full-stack application with Rust backend and Next.js + shadcn/ui frontend
          </p>
          <div className="flex items-center justify-center gap-3">
            <Badge variant="outline" className="text-lg px-4 py-1 bg-purple-500/20 text-purple-200 border-purple-400">
              Environment: {environment.toUpperCase()}
            </Badge>
            {health && (
              <Badge variant="outline" className="text-lg px-4 py-1 bg-green-500/20 text-green-200 border-green-400">
                Backend: {health.status}
              </Badge>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-8">
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Backend Status Card */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Server className="w-5 h-5" />
                Backend API
              </CardTitle>
              <CardDescription className="text-slate-300">Rust + Actix-web</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-slate-400">Loading...</p>
              ) : health ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <Badge variant="outline" className="bg-green-500/20 text-green-200 border-green-400">
                      {health.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Version:</span>
                    <span className="text-white">{health.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Environment:</span>
                    <span className="text-white">{health.environment}</span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => window.open(`${apiUrl}/docs`, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View API Docs
                  </Button>
                </div>
              ) : (
                <p className="text-red-400">Backend unavailable</p>
              )}
            </CardContent>
          </Card>

          {/* Users Card */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="w-5 h-5" />
                Users
              </CardTitle>
              <CardDescription className="text-slate-300">From backend API</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div>
                      <p className="font-semibold text-white">{user.name}</p>
                      <p className="text-sm text-slate-400">{user.email}</p>
                    </div>
                    <Badge variant="secondary">{user.id}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Infrastructure Card */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Activity className="w-5 h-5" />
                Infrastructure
              </CardTitle>
              <CardDescription className="text-slate-300">Kubernetes & GitOps</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Platform:</span>
                  <span className="text-white">K3s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">GitOps:</span>
                  <span className="text-white">Argo CD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">TLS:</span>
                  <span className="text-white">Let's Encrypt</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">DNS:</span>
                  <span className="text-white">ExternalDNS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Secrets:</span>
                  <span className="text-white">Vault</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Section */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Application Features</CardTitle>
            <CardDescription className="text-slate-300">
              Explore the different capabilities of this full-stack application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="backend" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="backend">Backend</TabsTrigger>
                <TabsTrigger value="frontend">Frontend</TabsTrigger>
                <TabsTrigger value="deployment">Deployment</TabsTrigger>
              </TabsList>
              <TabsContent value="backend" className="space-y-4">
                <div className="text-slate-300">
                  <h3 className="text-xl font-semibold text-white mb-3">Rust Backend Features</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li>Built with Actix-web framework</li>
                    <li>OpenAPI documentation at <code className="bg-slate-700 px-2 py-1 rounded">/docs</code></li>
                    <li>RESTful API with health checks</li>
                    <li>CORS enabled for cross-origin requests</li>
                    <li>Multi-stage Docker builds for optimization</li>
                    <li>Alpine-based containers for minimal size</li>
                  </ul>
                </div>
              </TabsContent>
              <TabsContent value="frontend" className="space-y-4">
                <div className="text-slate-300">
                  <h3 className="text-xl font-semibold text-white mb-3">Frontend Stack</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li>Next.js 14 with App Router</li>
                    <li>shadcn/ui component library</li>
                    <li>Tailwind CSS for styling</li>
                    <li>TypeScript for type safety</li>
                    <li>Responsive design</li>
                    <li>Dark mode support</li>
                  </ul>
                </div>
              </TabsContent>
              <TabsContent value="deployment" className="space-y-4">
                <div className="text-slate-300">
                  <h3 className="text-xl font-semibold text-white mb-3">Deployment Pipeline</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li>GitOps workflow with Argo CD</li>
                    <li>Multi-environment support (dev, staging, production)</li>
                    <li>GitHub Actions CI/CD pipelines</li>
                    <li>Kustomize for environment-specific configs</li>
                    <li>Automatic TLS certificates</li>
                    <li>DNS automation with ExternalDNS</li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
