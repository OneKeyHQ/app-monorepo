// onekey: extracted from `readResponseText` in internal/ohttp-client.ts so the
// streaming decompression path is platform-swappable. React Native's fetch
// exposes no `response.body` stream and Hermes has no `DecompressionStream`;
// see `decompressResponseText.native.ts`.
import { StarknetPrivacySdkPlatformError } from './errors';

export const MAX_DECOMPRESSED_RESPONSE_BYTES = 16 * 1024 * 1024;

/**
 * Read a `Content-Encoding`-compressed OHTTP inner response as text.
 *
 * `decapsulateResponse` rebuilds the inner `Response` by hand, so unlike a real
 * `fetch` response it does not auto-decompress.
 */
export async function decompressResponseText(
  response: Response,
  format: CompressionFormat,
): Promise<string> {
  if (typeof DecompressionStream === 'undefined') {
    throw new StarknetPrivacySdkPlatformError(
      `OHTTP response used Content-Encoding "${format}" but this runtime has no DecompressionStream`,
    );
  }
  if (!response.body) {
    throw new StarknetPrivacySdkPlatformError(
      `OHTTP response used Content-Encoding "${format}" but this runtime gives no readable response body`,
    );
  }
  const decompressed = response.body.pipeThrough(
    new DecompressionStream(format),
  );
  const reader = decompressed.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_DECOMPRESSED_RESPONSE_BYTES) {
        await reader.cancel();
        throw new StarknetPrivacySdkPlatformError(
          `OHTTP decompressed response exceeded ${MAX_DECOMPRESSED_RESPONSE_BYTES} bytes`,
        );
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join('');
  } finally {
    reader.releaseLock();
  }
}
