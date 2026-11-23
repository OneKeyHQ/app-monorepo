import { Gunzip, Unzlib, strFromU8 } from 'fflate';

import { StarknetPrivacySdkPlatformError } from './errors';

export const MAX_DECOMPRESSED_RESPONSE_BYTES = 16 * 1024 * 1024;
const CHUNK_SIZE = 64 * 1024;

export async function decompressResponseText(
  response: Response,
  format: CompressionFormat,
): Promise<string> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let limitExceeded = false;

  const stream =
    format === 'gzip'
      ? new Gunzip((chunk) => {
          totalBytes += chunk.byteLength;
          if (totalBytes > MAX_DECOMPRESSED_RESPONSE_BYTES) {
            limitExceeded = true;
            return;
          }
          chunks.push(chunk);
        })
      : new Unzlib((chunk) => {
          totalBytes += chunk.byteLength;
          if (totalBytes > MAX_DECOMPRESSED_RESPONSE_BYTES) {
            limitExceeded = true;
            return;
          }
          chunks.push(chunk);
        });

  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const end = Math.min(offset + CHUNK_SIZE, bytes.length);
    stream.push(bytes.subarray(offset, end), end === bytes.length);
    if (limitExceeded) {
      throw new StarknetPrivacySdkPlatformError(
        `OHTTP decompressed response exceeded ${MAX_DECOMPRESSED_RESPONSE_BYTES} bytes`,
      );
    }
  }
  if (bytes.length === 0) {
    stream.push(bytes, true);
  }

  const combined = new Uint8Array(totalBytes);
  let pos = 0;
  for (const chunk of chunks) {
    combined.set(chunk, pos);
    pos += chunk.byteLength;
  }
  return strFromU8(combined);
}
