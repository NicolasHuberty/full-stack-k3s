'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api, Memo, MemoMessage, FileInfo } from '@/lib/api';

export default function MemoDetailPage() {
  const router = useRouter();
  const params = useParams();
  const memoId = params.id as string;

  const [memo, setMemo] = useState<Memo | null>(null);
  const [messages, setMessages] = useState<MemoMessage[]>([]);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!api.isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadMemo();
    loadMessages();
    loadFiles();
  }, [memoId, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMemo = async () => {
    setLoading(true);
    setError('');
    try {
      const memoData = await api.getMemo(memoId);
      setMemo(memoData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memo');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const messagesList = await api.getMemoMessages(memoId);
      setMessages(messagesList);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const loadFiles = async () => {
    try {
      const filesList = await api.listFiles();
      setFiles(filesList);
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    setError('');

    try {
      const message = await api.createMemoMessage(memoId, newMessage);
      setMessages([...messages, message]);
      setNewMessage('');
      await loadMemo(); // Refresh memo to update message count
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      await api.uploadFile(file);
      await loadFiles();
      e.target.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAttachFile = async (fileId: string, messageId: string) => {
    try {
      await api.attachFileToMessage(memoId, messageId, fileId);
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach file');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!memo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Memo Not Found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This memo doesn't exist or you don't have access to it.
            </p>
            <Link href="/memos">
              <Button>Back to Memos</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="border-b bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/memos">
                <Button variant="ghost" size="sm">
                  ← Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold">{memo.title}</h1>
                {memo.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {memo.description}
                  </p>
                )}
              </div>
            </div>
            <Badge variant="secondary">
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="container mx-auto max-w-4xl space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">💬</div>
                <h3 className="text-lg font-medium mb-2">No messages yet</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Start the conversation by sending a message below
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xl px-4 py-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 border shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>

                    {message.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className={`text-xs p-2 rounded border ${
                              message.role === 'user'
                                ? 'bg-blue-700 border-blue-500'
                                : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            📎 {attachment.filename} ({(attachment.file_size / 1024).toFixed(1)} KB)
                          </div>
                        ))}
                      </div>
                    )}

                    <div
                      className={`text-xs mt-1 ${
                        message.role === 'user'
                          ? 'text-blue-200'
                          : 'text-gray-500'
                      }`}
                    >
                      {formatDate(message.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t bg-white dark:bg-gray-800 p-4">
          <div className="container mx-auto max-w-4xl">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700"
                  disabled={sending}
                />
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                <label htmlFor="file-upload">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    {uploading ? '📤...' : '📎'}
                  </Button>
                </label>
              </div>
              <Button type="submit" disabled={sending || !newMessage.trim()}>
                {sending ? 'Sending...' : 'Send'}
              </Button>
            </form>
            <p className="text-xs text-gray-500 mt-2 text-center">
              AI responses coming soon! For now, you can take notes and attach files.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
