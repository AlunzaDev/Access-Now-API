import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { FileStorage, SaveFileInput } from "../../../domain/ports/storage/file-storage.port";

type SpacesOptions = {
  key: string;
  secret: string;
  bucket: string;
  region: string;
  endpoint: string;
  cdnUrl?: string;
};

export class SpacesFileStorage implements FileStorage {
  private readonly client: S3Client;
  private readonly publicBaseUrl: string;

  constructor(private readonly options: SpacesOptions) {
    this.publicBaseUrl = (
      options.cdnUrl || `https://${options.bucket}.${options.endpoint.replace(/^https?:\/\//, "")}`
    ).replace(/\/+$/, "");
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      credentials: {
        accessKeyId: options.key,
        secretAccessKey: options.secret,
      },
      forcePathStyle: false,
    });
  }

  async save({ buffer, folder, fileName, contentType }: SaveFileInput): Promise<{ url: string }> {
    const key = `${folder}/${fileName}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: "public-read",
      }),
    );
    return { url: `${this.publicBaseUrl}/${key}` };
  }

  async deleteByUrl(url: string | null | undefined): Promise<void> {
    if (!url) return;
    const prefix = `${this.publicBaseUrl}/`;
    if (!url.startsWith(prefix)) return;
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.options.bucket,
        Key: decodeURIComponent(url.slice(prefix.length)),
      }),
    );
  }
}
