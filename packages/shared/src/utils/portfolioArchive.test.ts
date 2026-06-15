/*
yarn test packages/shared/src/utils/portfolioArchive.test.ts
*/
import {
  PORTFOLIO_ARCHIVE_HEADER_SIZE,
  PORTFOLIO_ARCHIVE_INDEX_ENTRY_SIZE,
  crc32,
  packPortfolioArchive,
} from './portfolioArchive';

function bytesToString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join('');
}

describe('portfolioArchive', () => {
  test('computes standard CRC32 vectors', () => {
    expect(crc32(new Uint8Array())).toBe(0);
    expect(crc32(Buffer.from('123456789'))).toBe(0xcb_f4_39_26);
  });

  test('packs one portfolio.json entry with a 4-byte aligned data offset', () => {
    const json = Buffer.from('{"v":1}', 'utf8');
    const archive = new Uint8Array(
      packPortfolioArchive([{ name: 'portfolio.json', bytes: json }]),
    );
    const view = new DataView(
      archive.buffer,
      archive.byteOffset,
      archive.byteLength,
    );

    expect(view.getUint32(0, true)).toBe(0x52_41_4b_4f);
    expect(view.getUint16(4, true)).toBe(1);
    expect(view.getUint32(6, true)).toBe(1);

    const indexOffset = PORTFOLIO_ARCHIVE_HEADER_SIZE;
    expect(archive[indexOffset]).toBe('portfolio.json'.length);
    expect(
      bytesToString(
        archive.slice(
          indexOffset + 1,
          indexOffset + 1 + 'portfolio.json'.length,
        ),
      ),
    ).toBe('portfolio.json');

    const dataOffsetField = indexOffset + 1 + 255;
    const dataOffset = view.getUint32(dataOffsetField, true);
    expect(dataOffset).toBe(
      PORTFOLIO_ARCHIVE_HEADER_SIZE + PORTFOLIO_ARCHIVE_INDEX_ENTRY_SIZE + 2,
    );
    expect(dataOffset % 4).toBe(0);
    expect(view.getUint32(dataOffsetField + 4, true)).toBe(json.length);
    expect(view.getUint32(dataOffsetField + 8, true)).toBe(json.length);
    expect(view.getUint32(dataOffsetField + 12, true)).toBe(crc32(json));
    expect(view.getUint32(dataOffsetField + 16, true)).toBe(crc32(json));
    expect(archive[dataOffsetField + 20]).toBe(0);
    expect(bytesToString(archive.slice(dataOffset))).toBe('{"v":1}');
  });

  test('rejects entry names longer than 255 UTF-8 bytes', () => {
    expect(() =>
      packPortfolioArchive([
        {
          name: 'a'.repeat(256),
          bytes: Buffer.from('{}'),
        },
      ]),
    ).toThrow('Archive entry name is too long');
  });
});
