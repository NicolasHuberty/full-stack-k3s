export interface File {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  s3Key: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileUploadResult {
  fileId: string;
  filename: string;
  size: number;
  url: string;
}
