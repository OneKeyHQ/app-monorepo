/* eslint-disable no-control-regex */
import { toASCII } from 'punycode';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export function encodeDnsName(domain: string): Buffer {
  if (!domain) {
    throw new OneKeyLocalError('Domain must be non-empty');
  }

  // eslint-disable-next-line spellcheck/spell-checker
  // Normalise (lower-case, strip trailing dot) – recommended for interop
  let norm = domain.toLowerCase();
  if (norm.endsWith('.')) norm = norm.slice(0, -1);

  // Special case: single dot (“.”) ⇒ self-reference ⇒ single 0x00
  if (norm === '') {
    return Buffer.from([0]);
  }

  // Split & validate labels
  const labelsAscii = norm.split('.').map((lbl) => {
    if (lbl.length === 0) {
      throw new OneKeyLocalError('Empty label ("..") not allowed');
    }
    // IDN: convert Unicode → punycode ASCII (xn--…)
    const ascii = toASCII(lbl);
    // Disallow bytes 0x00–0x20 and label > 63 chars (classic DNS rule)
    if (ascii.length > 63 || /[\x00-\x20]/.test(ascii)) {
      throw new OneKeyLocalError(`Invalid label "${lbl}"`);
    }
    return ascii;
  });

  // Build byte array: reverse order + 0x00 after each label
  const byteChunks: number[] = [];
  for (const label of labelsAscii.reverse()) {
    byteChunks.push(...Buffer.from(label, 'utf8'), 0);
  }
  const bytes = Buffer.from(byteChunks);

  if (bytes.length > 126) {
    throw new OneKeyLocalError(
      `Encoded name is ${bytes.length} bytes; TEP-81 allows at most 126`,
    );
  }

  return bytes;
}
