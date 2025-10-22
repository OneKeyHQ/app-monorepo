export type ILogBundle =
  | {
      type: 'text';
      fileName: string;
      mimeType: string;
      blob: Blob;
      content: string;
    }
  | {
      type: 'file';
      fileName: string;
      mimeType: string;
      filePath: string;
    };

export type ILogDigest = {
  sizeBytes: number;
  sha256: string;
  bundle: ILogBundle;
};

export type ILogUploadResponse = {
  objectKey: string;
  uploadedBytes: number;
  durationMs: number;
};
