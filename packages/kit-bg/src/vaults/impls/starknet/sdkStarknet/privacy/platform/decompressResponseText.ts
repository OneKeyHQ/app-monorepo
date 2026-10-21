// onekey: extracted from `readResponseText` in internal/ohttp-client.ts so the
// streaming decompression path is platform-swappable. React Native's fetch
// exposes no `response.body` stream and Hermes has no `DecompressionStream`;
// see `decompressResponseText.native.ts`.
import { StarknetPrivacySdkPlatformError } from './errors';

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
  return new Response(decompressed).text();
}
