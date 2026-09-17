/* eslint-disable no-bitwise */
import { OneKeyLocalError } from '../errors';

export const PORTFOLIO_ARCHIVE_HEADER_SIZE = 42;
export const PORTFOLIO_ARCHIVE_INDEX_ENTRY_SIZE = 296;
export const PORTFOLIO_ARCHIVE_MAX_BYTES = 64 * 1024;

export type IPortfolioArchiveEntry = {
  name: string;
  bytes: Uint8Array;
};

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

export function crc32(bytes: Uint8Array): number {
  let crc = 0xff_ff_ff_ff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}

function align4(value: number): number {
  return (value + 3) & ~3;
}

function writeAscii(target: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    target[offset + i] = text.charCodeAt(i);
  }
}

export function packPortfolioArchive(
  entries: IPortfolioArchiveEntry[],
): ArrayBuffer {
  const normalizedEntries = entries.map((entry) => {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    if (nameBytes.length > 255) {
      throw new OneKeyLocalError('Archive entry name is too long');
    }
    return {
      ...entry,
      nameBytes,
    };
  });

  let nextDataOffset = align4(
    PORTFOLIO_ARCHIVE_HEADER_SIZE +
      normalizedEntries.length * PORTFOLIO_ARCHIVE_INDEX_ENTRY_SIZE,
  );
  const entriesWithOffset = normalizedEntries.map((entry) => {
    const dataOffset = nextDataOffset;
    nextDataOffset = align4(dataOffset + entry.bytes.length);
    return {
      ...entry,
      dataOffset,
    };
  });

  const archiveSize =
    entriesWithOffset.length > 0
      ? entriesWithOffset[entriesWithOffset.length - 1].dataOffset +
        entriesWithOffset[entriesWithOffset.length - 1].bytes.length
      : PORTFOLIO_ARCHIVE_HEADER_SIZE;

  if (archiveSize > PORTFOLIO_ARCHIVE_MAX_BYTES) {
    throw new OneKeyLocalError('Archive is too large');
  }

  const archive = new Uint8Array(archiveSize);
  const view = new DataView(archive.buffer);

  writeAscii(archive, 0, 'OKAR');
  view.setUint16(4, 1, true);
  view.setUint32(6, entriesWithOffset.length, true);

  entriesWithOffset.forEach((entry, index) => {
    const indexOffset =
      PORTFOLIO_ARCHIVE_HEADER_SIZE +
      index * PORTFOLIO_ARCHIVE_INDEX_ENTRY_SIZE;
    archive[indexOffset] = entry.nameBytes.length;
    archive.set(entry.nameBytes, indexOffset + 1);

    const dataOffsetField = indexOffset + 1 + 255;
    const checksum = crc32(entry.bytes);
    view.setUint32(dataOffsetField, entry.dataOffset, true);
    view.setUint32(dataOffsetField + 4, entry.bytes.length, true);
    view.setUint32(dataOffsetField + 8, entry.bytes.length, true);
    view.setUint32(dataOffsetField + 12, checksum, true);
    view.setUint32(dataOffsetField + 16, checksum, true);
    archive[dataOffsetField + 20] = 0;
    archive.set(entry.bytes, entry.dataOffset);
  });

  return archive.buffer;
}
