import type { MemoStatus } from "@/generated/prisma";

export type { MemoStatus };

export interface Memo {
  id: string;
  userId: string;
  title: string;
  content: string;
  status: MemoStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoWithFiles extends Memo {
  files: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    s3Key: string;
  }[];
}

export interface MemoWithUser extends Memo {
  user: {
    id: string;
    email: string;
    name: string;
  };
}
