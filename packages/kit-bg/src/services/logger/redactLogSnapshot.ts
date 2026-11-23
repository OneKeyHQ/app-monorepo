import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { redactSensitiveLogText } from '@onekeyhq/shared/src/logger/utils/redactSensitiveLogText';

const PAGE_BYTES = 64 * 1024;
// A line longer than this is redacted in pieces instead of buffered whole.
const MAX_PENDING_CHARS = 256 * 1024;

// Redacts a text snapshot page by page, carrying an unfinished line into the
// next page so a secret split across a page boundary is still matched.
export async function redactLogSnapshot(
  source: Blob,
  isCancelled: () => boolean = () => false,
): Promise<Blob> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  let pending = '';
  for (let offset = 0; offset < source.size; offset += PAGE_BYTES) {
    const bytes = new Uint8Array(
      await source.slice(offset, offset + PAGE_BYTES).arrayBuffer(),
    );
    if (isCancelled()) throw new OneKeyLocalError('Log export cancelled');
    pending += decoder.decode(bytes, { stream: true });
    const lineEnd = pending.lastIndexOf('\n');
    if (lineEnd >= 0 || pending.length >= MAX_PENDING_CHARS) {
      const cut = lineEnd >= 0 ? lineEnd + 1 : pending.length;
      parts.push(encoder.encode(redactSensitiveLogText(pending.slice(0, cut))));
      pending = pending.slice(cut);
    }
  }
  pending += decoder.decode();
  if (pending) parts.push(encoder.encode(redactSensitiveLogText(pending)));
  return new Blob(parts, { type: source.type || 'text/plain' });
}
