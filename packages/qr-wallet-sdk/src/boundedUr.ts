// Not re-exported by the package root; pinned with the package version.
import urWords from '@ngraveio/bc-ur/dist/bytewords';

/** Nesting deeper than any wallet payload; bounds the walk's recursion. */
const MAX_CBOR_DEPTH = 64;
/** Larger than any scanned payload, including big PSBTs. */
const MAX_CBOR_BYTES = 8 * 1024 * 1024;
/**
 * Animated codes stay far below this (4096 parts of 200 bytes is about 800 KB); the fountain
 * decoder allocates per declared part, so an unbounded count in one scanned frame exhausts memory
 * before any check could run.
 */
const MAX_UR_SEQ_LENGTH = 4096;
/** Argument bytes for additional info 24, 25, 26 and 27. */
const ARGUMENT_BYTES = [1, 2, 4, 8];

function malformed(reason: string): Error {
  return new Error(`Malformed QR payload: ${reason}`);
}

/**
 * Walks CBOR from a scanned code before the vendor decoders see it. They read past the end as
 * zero and trust declared lengths, so one indefinite-length header or a huge declared count
 * exhausts memory. This walk accepts only definite lengths that fit in the bytes present,
 * bounded nesting, and no trailing bytes.
 */
export function assertBoundedCbor(input: Uint8Array): void {
  if (input.length === 0) throw malformed('empty');
  if (input.length > MAX_CBOR_BYTES) throw malformed('too large');
  let offset = 0;

  const readArgument = (info: number): number => {
    if (info < 24) return info;
    const size = ARGUMENT_BYTES[info - 24];
    if (offset + size > input.length) throw malformed('truncated length');
    let value = 0;
    for (let i = 0; i < size; i += 1) value = value * 256 + input[offset + i];
    offset += size;
    return value;
  };

  const walkItem = (depth: number): void => {
    if (depth > MAX_CBOR_DEPTH) throw malformed('nested too deeply');
    if (offset >= input.length) throw malformed('truncated item');
    const initial = input[offset];
    offset += 1;
    // High three bits: major type; low five: the additional info.
    const major = Math.floor(initial / 32);
    const info = initial % 32;
    // 31 is an indefinite length (or a stray break); 28-30 are reserved.
    if (info >= 28) throw malformed('indefinite or reserved length');
    const argument = readArgument(info);
    const remaining = input.length - offset;
    if (major === 2 || major === 3) {
      if (argument > remaining)
        throw malformed('string longer than the payload');
      offset += argument;
    } else if (major === 4 || major === 5) {
      // Every element takes at least one byte; a map holds two per entry.
      const items = major === 5 ? argument * 2 : argument;
      if (items > remaining) {
        throw malformed('container longer than the payload');
      }
      for (let i = 0; i < items; i += 1) walkItem(depth + 1);
    } else if (major === 6) {
      walkItem(depth + 1);
    }
    // 0/1 integers and 7 simple values or floats carry only the argument already read.
  };

  walkItem(0);
  if (offset !== input.length) throw malformed('trailing bytes');
}

/** Checks one scanned UR part before the vendor decoder parses its CBOR. */
export function assertBoundedUrPart(part: string): void {
  const match = /^ur:[a-z0-9-]+\/(?:(\d{1,9})-(\d{1,9})\/)?([a-z]+)$/i.exec(
    part.trim(),
  );
  if (!match) throw malformed('not a UR');
  const seqLength = match[2] === undefined ? undefined : Number(match[2]);
  if (
    seqLength !== undefined &&
    (seqLength < 1 || seqLength > MAX_UR_SEQ_LENGTH)
  ) {
    throw malformed('unsupported number of parts');
  }
  // Minimal-style UR words carry their own CRC32; decode throws on a mismatch.
  const payloadHex = urWords.decode(
    match[3].toLowerCase(),
    urWords.STYLES.MINIMAL,
  );
  assertBoundedCbor(Buffer.from(payloadHex, 'hex'));
}

/**
 * A frame that fails the bounds is dropped, as the vendor decoder drops a frame with a bad
 * checksum: one misread frame must not end a scan.
 */
export function isBoundedUrPart(part: string): boolean {
  try {
    assertBoundedUrPart(part);
    return true;
  } catch {
    return false;
  }
}
