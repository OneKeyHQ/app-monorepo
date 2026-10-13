// Not re-exported by the package root; pinned with the package version.
import urWords from '@ngraveio/bc-ur/dist/bytewords';

/** Nesting deeper than any wallet payload; bounds the walk's recursion. */
const MAX_CBOR_DEPTH = 64;
/** The most data a scanned code may carry, whatever its fragment size. */
export const MAX_UR_MESSAGE_BYTES = 1024 * 1024;
/**
 * The fountain decoder's work per mixed frame grows with the square of the part count, so a code
 * cut into tiny fragments can stall the scanner even within the byte limit. 32768 parts keeps a
 * frame to a fraction of a second; a real code of that many parts would take an hour to scan.
 */
export const MAX_UR_SEQ_LENGTH = 32_768;
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
  if (input.length > MAX_UR_MESSAGE_BYTES) throw malformed('too large');
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

/**
 * Reads a fountain part `[seqNum, seqLen, messageLen, checksum, fragment]`. The input has already
 * passed `assertBoundedCbor`, so every declared length fits in it.
 */
function readFountainPart(input: Uint8Array): {
  seqNum: number;
  seqLength: number;
  messageLength: number;
  fragmentLength: number;
} {
  let offset = 0;
  const readHead = (expectedMajor: number): number => {
    const initial = input[offset];
    offset += 1;
    if (Math.floor(initial / 32) !== expectedMajor) {
      throw malformed('not a fountain part');
    }
    const info = initial % 32;
    if (info < 24) return info;
    const size = ARGUMENT_BYTES[info - 24];
    let value = 0;
    for (let i = 0; i < size; i += 1) value = value * 256 + input[offset + i];
    offset += size;
    return value;
  };
  if (readHead(4) !== 5) throw malformed('not a fountain part');
  const seqNum = readHead(0);
  const seqLength = readHead(0);
  const messageLength = readHead(0);
  readHead(0); // checksum
  const fragmentLength = readHead(2);
  return { seqNum, seqLength, messageLength, fragmentLength };
}

export type IUrPartVerdict = 'ok' | 'malformed' | 'too-large';

/**
 * Judges one scanned UR part before the vendor decoder parses it. `malformed` frames (misreads,
 * bad checksums, forged headers) are to be dropped so one bad frame does not end a scan;
 * `too-large` frames belong to a code beyond the limits and should end the scan with an error.
 */
export function checkUrPart(part: string): IUrPartVerdict {
  const match = /^ur:[a-z0-9-]+\/(?:(\d{1,9})-(\d{1,9})\/)?([a-z]+)$/i.exec(
    part.trim(),
  );
  if (!match) return 'malformed';
  let payload: Buffer;
  try {
    // Minimal-style UR words carry their own CRC32; decode throws on a mismatch.
    payload = Buffer.from(
      urWords.decode(match[3].toLowerCase(), urWords.STYLES.MINIMAL),
      'hex',
    );
  } catch {
    return 'malformed';
  }
  if (match[1] === undefined) {
    // A single-part code is the whole message.
    if (payload.length > MAX_UR_MESSAGE_BYTES) return 'too-large';
    try {
      assertBoundedCbor(payload);
    } catch {
      return 'malformed';
    }
    return 'ok';
  }
  try {
    assertBoundedCbor(payload);
    const header = readFountainPart(payload);
    // The text header, the CBOR header and the real sizes must agree, so the part count a frame
    // declares is tied to the data it actually carries.
    if (
      header.seqNum !== Number(match[1]) ||
      header.seqLength !== Number(match[2]) ||
      header.fragmentLength < 1 ||
      header.messageLength < 1 ||
      header.seqLength !==
        Math.ceil(header.messageLength / header.fragmentLength)
    ) {
      return 'malformed';
    }
    if (
      header.messageLength > MAX_UR_MESSAGE_BYTES ||
      header.seqLength > MAX_UR_SEQ_LENGTH
    ) {
      return 'too-large';
    }
  } catch {
    return 'malformed';
  }
  return 'ok';
}

/** The error a scan ends with when a code exceeds the size or part-count limits. */
export function urTooLargeError(): Error {
  return new Error(
    `QR code is too large to scan (over ${MAX_UR_MESSAGE_BYTES} bytes or ${MAX_UR_SEQ_LENGTH} parts)`,
  );
}
