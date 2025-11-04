export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithStats extends User {
  memoCount: number;
  fileCount: number;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string;
}
