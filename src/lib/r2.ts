import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 speaks the S3 API. Credentials come from Vercel env vars.
// Lazily constructed so builds/dev without R2 creds don't crash.
let _client: S3Client | null = null;

function client(): S3Client | null {
  if (_client) return _client;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export function r2Configured(): boolean {
  return client() !== null;
}

/**
 * Presigned GET URL for an object key. Returns null if R2 isn't configured
 * (e.g. local dev without creds) so callers can degrade gracefully.
 */
export async function presign(
  key: string,
  expiresIn = 3600,
  opts?: { downloadFilename?: string },
): Promise<string | null> {
  const c = client();
  const bucket = process.env.R2_BUCKET;
  if (!c || !bucket || !key) return null;
  try {
    return await getSignedUrl(
      c,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        // Force a download (with a proper UTF-8 filename) when requested.
        ...(opts?.downloadFilename
          ? {
              ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(
                opts.downloadFilename,
              )}`,
            }
          : {}),
      }),
      { expiresIn },
    );
  } catch {
    return null;
  }
}
