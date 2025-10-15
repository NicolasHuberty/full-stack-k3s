'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api, Memo } from '@/lib/api';

export default function MemosPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const userData = api.getUser();
    if (!userData) {
      router.push('/login');
      return;
    }
    setUser(userData);
    loadMemos();
  }, [router]);

  const loadMemos = async () => {
    setLoading(true);
    setError('');
    try {
      const memosList = await api.listMemos();
      setMemos(memosList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      const memo = await api.createMemo(newTitle, newDescription || undefined);
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      router.push(`/memos/${memo.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create memo');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteMemo = async (memoId: string) => {
    if (!confirm('Are you sure you want to delete this memo?')) return;

    try {
      await api.deleteMemo(memoId);
      await loadMemos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete memo');
    }
  };

  const handleLogout = async () => {
    await api.logout();
    router.push('/login');
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Memos</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold">Your Memos</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Conversation-based notes with AI assistance
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            + New Memo
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading memos...</div>
        ) : memos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-lg font-medium mb-2">No memos yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first memo to start taking notes with AI assistance
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                Create Your First Memo
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {memos.map((memo) => (
              <Card key={memo.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <Link href={`/memos/${memo.id}`}>
                        <CardTitle className="hover:text-blue-600 cursor-pointer">
                          {memo.title}
                        </CardTitle>
                      </Link>
                      {memo.description && (
                        <CardDescription className="mt-2">
                          {memo.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex gap-2">
                      <Badge variant="secondary">
                        {memo.message_count} {memo.message_count === 1 ? 'message' : 'messages'}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/memos/${memo.id}`}>
                        <Button variant="outline" size="sm">
                          Open
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteMemo(memo.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Updated {new Date(memo.updated_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Memo Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create New Memo</CardTitle>
              <CardDescription>
                Start a new conversation-based note
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateMemo} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="title" className="text-sm font-medium">
                    Title *
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                    placeholder="My Memo"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium">
                    Description (optional)
                  </label>
                  <textarea
                    id="description"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                    placeholder="What is this memo about?"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewTitle('');
                      setNewDescription('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating || !newTitle.trim()}>
                    {creating ? 'Creating...' : 'Create Memo'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
