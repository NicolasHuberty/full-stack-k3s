"use client";

import { FileText, Plus, Settings, Users } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Team {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  members: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  _count: {
    memos: number;
    forms: number;
  };
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const { data } = await res.json();
        setTeams(data);
      }
    } catch (error) {
      console.error("Load teams error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const createTeam = async () => {
    if (!newTeamName.trim()) {
      alert("Please enter a team name");
      return;
    }

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTeamName,
          description: newTeamDescription,
        }),
      });

      if (res.ok) {
        setNewTeamName("");
        setNewTeamDescription("");
        setShowCreateModal(false);
        loadTeams();
      }
    } catch (error) {
      console.error("Create team error:", error);
      alert("Failed to create team");
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Teams</h1>
            <p className="text-muted-foreground mt-1">
              Collaborate with your team members
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="size-4 mr-2" />
            Create Team
          </Button>
        </div>

        {showCreateModal && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create New Team</CardTitle>
              <CardDescription>
                Set up a team to collaborate with others
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Team Name</Label>
                <Input
                  placeholder="e.g., Sales Team"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  placeholder="Describe your team's purpose..."
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={createTeam}>Create</Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading teams...
          </div>
        ) : teams.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="size-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
              <p className="text-muted-foreground mb-4">
                Create a team to start collaborating with others
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="size-4 mr-2" />
                Create Team
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <Card key={team.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{team.name}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">
                        {team.description || "No description"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-muted-foreground" />
                      <span className="text-sm">
                        {team.members.length} member
                        {team.members.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Memos</span>
                      <span className="font-medium">{team._count.memos}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Forms</span>
                      <span className="font-medium">{team._count.forms}</span>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {team.members.slice(0, 3).map((member) => (
                        <Badge key={member.id} variant="secondary">
                          {member.user.name}
                        </Badge>
                      ))}
                      {team.members.length > 3 && (
                        <Badge variant="secondary">
                          +{team.members.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Link href={`/teams/${team.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <FileText className="size-4 mr-2" />
                        View Memos
                      </Button>
                    </Link>
                    <Link href={`/teams/${team.id}/settings`}>
                      <Button variant="outline" size="sm">
                        <Settings className="size-4" />
                      </Button>
                    </Link>
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
