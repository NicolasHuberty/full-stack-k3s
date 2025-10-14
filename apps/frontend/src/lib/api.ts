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

export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  token: string;
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
  private getHeaders(includeAuth = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
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
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
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
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  getUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  async uploadFile(file: File): Promise<FileInfo> {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/files/upload`, {
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
    const response = await fetch(`${API_URL}/api/files`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }

    return await response.json();
  }

  async deleteFile(fileId: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/files/${fileId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to delete file');
    }
  }

  async search(query: string, limit?: number): Promise<SearchResult[]> {
    const response = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ query, limit }),
    });

    if (!response.ok) {
      throw new Error('Search failed');
    }

    const data = await response.json();
    return data.results;
  }

  async ragQuery(query: string, contextLimit?: number): Promise<RagResponse> {
    const response = await fetch(`${API_URL}/api/rag/query`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ query, context_limit: contextLimit }),
    });

    if (!response.ok) {
      throw new Error('Query failed');
    }

    return await response.json();
  }

  async getChatHistory(): Promise<ChatMessage[]> {
    const response = await fetch(`${API_URL}/api/rag/history`, {
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch history');
    }

    return await response.json();
  }
}

export const api = new ApiClient();
