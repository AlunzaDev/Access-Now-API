import { mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { FileStorage, SaveFileInput } from "../../../domain/ports/storage/file-storage.port";

export class LocalFileStorage implements FileStorage {
  private readonly uploadsRoot: string;
  private readonly publicBaseUrl: string;

  constructor(publicPath: string, serviceUrl: string) {
    this.uploadsRoot = resolve(process.cwd(), publicPath, "uploads");
    this.publicBaseUrl = `${serviceUrl.replace(/\/+$/, "")}/uploads`;
  }

  async save({ buffer, folder, fileName }: SaveFileInput): Promise<{ url: string }> {
    const directory = resolve(this.uploadsRoot, folder);
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, fileName), buffer);
    return { url: `${this.publicBaseUrl}/${folder}/${fileName}` };
  }

  async deleteByUrl(url: string | null | undefined): Promise<void> {
    if (!url) return;
    const prefix = `${this.publicBaseUrl}/`;
    if (!url.startsWith(prefix)) return;
    const target = resolve(this.uploadsRoot, decodeURIComponent(url.slice(prefix.length)));
    if (!target.startsWith(`${this.uploadsRoot}${sep}`)) return;
    await unlink(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
