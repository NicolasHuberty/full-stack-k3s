'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, FileInfo, ChatMessage, RagResponse } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState('');
  const [querying, setQuerying] = useState(false);
  const [queryError, setQueryError] = useState('');

  useEffect(() => {
    const userData = api.getUser();
    if (!userData) {
      router.push('/login');
      return;
    }
    setUser(userData);
    loadFiles();
    loadChatHistory();
  }, [router]);

  const loadFiles = async () => {
    try {
      const fileList = await api.listFiles();
      setFiles(fileList);
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  };

  const loadChatHistory = async () => {
    try {
      const history = await api.getChatHistory();
      setChatMessages(history);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');

    try {
      await api.uploadFile(file);
      await loadFiles();
      e.target.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await api.deleteFile(fileId);
      await loadFiles();
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setQuerying(true);
    setQueryError('');

    try {
      const response = await api.ragQuery(query);

      setChatMessages([
        ...chatMessages,
        { role: 'user', content: query },
        { role: 'assistant', content: response.answer },
      ]);

      setQuery('');
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setQuerying(false);
    }
  };

  const handleViewFile = (fileId: string) => {
    const token = api.getToken();
    if (!token) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const fileUrl = `${apiUrl}/api/files/${fileId}/download`;

    // Open file in new tab with auth header
    // We'll use a fetch + blob URL approach to pass the auth header
    fetch(fileUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    })
    .catch(err => {
      console.error('Failed to open file:', err);
      alert('Failed to open file');
    });
  };

  const handleLogout = () => {
    api.logout();
    router.push('/login');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">RAG Dashboard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="chat" className="space-y-4">
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ask Questions About Your Documents</CardTitle>
                <CardDescription>
                  Upload files in the Files tab, then ask questions here
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {queryError && (
                  <Alert variant="destructive">
                    <AlertDescription>{queryError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4 max-h-96 overflow-y-auto p-4 border rounded-md bg-gray-50 dark:bg-gray-900">
                  {chatMessages.length === 0 ? (
                    <p className="text-center text-gray-500">No messages yet. Start by asking a question!</p>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xl px-4 py-2 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-gray-800 border'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleQuery} className="flex gap-2">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask a question about your documents..."
                    className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                    disabled={querying}
                  />
                  <Button type="submit" disabled={querying || !query.trim()}>
                    {querying ? 'Asking...' : 'Ask'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload Documents</CardTitle>
                <CardDescription>Upload text files to enable RAG queries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {uploadError && (
                  <Alert variant="destructive">
                    <AlertDescription>{uploadError}</AlertDescription>
                  </Alert>
                )}

                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <div className="text-4xl">📁</div>
                    <div className="font-medium">
                      {uploading ? 'Uploading...' : 'Click to upload a file'}
                    </div>
                    <div className="text-sm text-gray-500">
                      Supports TXT, MD, PDF, and other text formats
                    </div>
                  </label>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Your Files ({files.length})</h3>
                  {files.length === 0 ? (
                    <p className="text-sm text-gray-500">No files uploaded yet</p>
                  ) : (
                    <div className="space-y-2">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 border rounded-md bg-white dark:bg-gray-800"
                        >
                          <div className="flex-1">
                            <button
                              onClick={() => handleViewFile(file.id)}
                              className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-left hover:underline"
                            >
                              {file.filename}
                            </button>
                            <p className="text-sm text-gray-500">
                              {(file.file_size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{file.status}</Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewFile(file.id)}
                            >
                              View
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteFile(file.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
