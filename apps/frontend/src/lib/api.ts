// Determine API URL based on environment
const getApiUrl = () => {
  // If explicitly set, use that
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // In browser, detect based on current hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Production
    if (hostname === 'app.huberty.pro') {
      return 'https://api.huberty.pro';
    }
    // Staging
    if (hostname === 'staging.huberty.pro') {
      return 'https://api-staging.huberty.pro';
    }
    // Dev
    if (hostname === 'dev.huberty.pro') {
      return 'https://api-dev.huberty.pro';
    }
  }

  // Fallback to localhost for development
  return 'http://localhost:8080';
};

const API_URL = getApiUrl();

// Types
export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface FileInfo {
  id: string;
  filename: string;
  file_size: number;
  mime_type?: string;
  status: string;
  created_at: string;
}

export interface Memo {
  id: string;
  title: string;
  description?: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface MemoMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  attachments: MemoAttachment[];
  created_at: string;
}

export interface MemoAttachment {
  id: string;
  filename: string;
  mime_type?: string;
  file_size: number;
  created_at: string;
}

export interface SearchResult {
  file_id: string;
  filename: string;
  chunk_text: string;
  score: number;
}

export interface RagResponse {
  answer: string;
  sources: string[];
}

export interface ChatMessage {
  role: string;
  content: string;
}

class ApiClient {
  private refreshPromise: Promise<void> | null = null;

  private getHeaders(includeAuth = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = localStorage.getItem('access_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async refreshToken(): Promise<void> {
    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) {
          // Refresh failed, clear tokens and throw
          this.logout();
          throw new Error('Token refresh failed');
        }

        const data: AuthResponse = await response.json();
        this.saveAuthData(data);
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    // Try the request
    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...this.getHeaders(true),
      },
    });

    // If unauthorized, try refreshing token
    if (response.status === 401) {
      try {
        await this.refreshToken();
        // Retry the request with new token
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            ...this.getHeaders(true),
          },
        });
      } catch (error) {
        // Refresh failed, redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw error;
      }
    }

    return response;
  }

  private saveAuthData(data: AuthResponse): void {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('token_expires_at', String(Date.now() + data.expires_in * 1000));
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  async register(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data = await response.json();
    this.saveAuthData(data);
    return data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    this.saveAuthData(data);
    return data;
  }

  async logout(): Promise<void> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await this.fetchWithAuth(`${API_URL}/api/auth/logout`, {
          method: 'POST',
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token_expires_at');
      localStorage.removeItem('user');
    }
  }

  getUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  }

  // File endpoints
  async uploadFile(file: File): Promise<FileInfo> {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('access_token');
    const response = await this.fetchWithAuth(`${API_URL}/api/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    return await response.json();
  }

  async listFiles(): Promise<FileInfo[]> {
    const response = await this.fetchWithAuth(`${API_URL}/api/files`);

    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }

    return await response.json();
  }

  async deleteFile(fileId: string): Promise<void> {
    const response = await this.fetchWithAuth(`${API_URL}/api/files/${fileId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete file');
    }
  }

  // Memo endpoints
  async createMemo(title: string, description?: string): Promise<Memo> {
    const response = await this.fetchWithAuth(`${API_URL}/api/memos`, {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create memo');
    }

    return await response.json();
  }

  async listMemos(): Promise<Memo[]> {
    const response = await this.fetchWithAuth(`${API_URL}/api/memos`);

    if (!response.ok) {
      throw new Error('Failed to fetch memos');
    }

    return await response.json();
  }

  async getMemo(memoId: string): Promise<Memo> {
    const response = await this.fetchWithAuth(`${API_URL}/api/memos/${memoId}`);

    if (!response.ok) {
      throw new Error('Failed to fetch memo');
    }

    return await response.json();
  }

  async deleteMemo(memoId: string): Promise<void> {
    const response = await this.fetchWithAuth(`${API_URL}/api/memos/${memoId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete memo');
    }
  }

  async getMemoMessages(memoId: string): Promise<MemoMessage[]> {
    const response = await this.fetchWithAuth(`${API_URL}/api/memos/${memoId}/messages`);

    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }

    return await response.json();
  }

  async createMemoMessage(memoId: string, content: string): Promise<MemoMessage> {
    const response = await this.fetchWithAuth(`${API_URL}/api/memos/${memoId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create message');
    }

    return await response.json();
  }

  async attachFileToMessage(memoId: string, messageId: string, fileId: string): Promise<void> {
    const response = await this.fetchWithAuth(
      `${API_URL}/api/memos/${memoId}/messages/${messageId}/attach/${fileId}`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to attach file');
    }
  }

  // Legacy RAG endpoints
  async search(query: string, limit?: number): Promise<SearchResult[]> {
    const response = await this.fetchWithAuth(`${API_URL}/api/search`, {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    });

    if (!response.ok) {
      throw new Error('Search failed');
    }

    const data = await response.json();
    return data.results;
  }

  async ragQuery(query: string, contextLimit?: number): Promise<RagResponse> {
    const response = await this.fetchWithAuth(`${API_URL}/api/rag/query`, {
      method: 'POST',
      body: JSON.stringify({ query, context_limit: contextLimit }),
    });

    if (!response.ok) {
      throw new Error('Query failed');
    }

    return await response.json();
  }

  async getChatHistory(): Promise<ChatMessage[]> {
    const response = await this.fetchWithAuth(`${API_URL}/api/rag/history`);

    if (!response.ok) {
      throw new Error('Failed to fetch history');
    }

    return await response.json();
  }
}

export const api = new ApiClient();
