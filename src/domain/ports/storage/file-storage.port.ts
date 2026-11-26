export type FileUpload = { buffer: Buffer; contentType: string };

export type SaveFileInput = FileUpload & { folder: string; fileName: string };

export interface FileStorage {
  save(input: SaveFileInput): Promise<{ url: string }>;
  deleteByUrl(url: string | null | undefined): Promise<void>;
}
