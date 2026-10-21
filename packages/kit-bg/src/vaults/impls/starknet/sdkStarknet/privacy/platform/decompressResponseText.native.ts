// onekey: React Native's fetch has no streaming response body and Hermes has no
// DecompressionStream, so a compressed OHTTP inner response cannot be read.
// Every other step of the non-chunked OHTTP path is buffer-based
// (`request.arrayBuffer()` / `response.arrayBuffer()` in ohttp-ts 0.3.0), so this
// is the only OHTTP step that is unreachable on native. Fail loudly rather than
// hand compressed bytes back as text: serve identity-encoded OHTTP responses to
// the mobile target.
import { StarknetPrivacySdkPlatformError } from './errors';

export function decompressResponseText(
  _response: Response,
  format: CompressionFormat,
): Promise<string> {
  return Promise.reject(
    new StarknetPrivacySdkPlatformError(
      `OHTTP response used Content-Encoding "${format}", which React Native cannot decompress (no streaming response body). Configure the OHTTP gateway to send identity-encoded responses.`,
    ),
  );
}
