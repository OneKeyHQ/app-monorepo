import { randomBytes } from 'crypto';
import { inflateRawSync } from 'zlib';

import { createLogArchive } from './createLogArchive';

jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));

describe('streaming diagnostic ZIP', () => {
  it.each([
    Buffer.from('日志🙂\r\n'.repeat(30_000)),
    randomBytes(300_000),
    Buffer.alloc(0),
  ])(
    'writes a standard ZIP with an intact deflate stream',
    async (original) => {
      const archive = await createLogArchive(
        new Blob([new Uint8Array(original)]),
      );
      const bytes = Buffer.from(await archive.arrayBuffer());
      expect(archive.type).toBe('application/zip');
      expect(bytes.readUInt32LE(0)).toBe(0x04_03_4b_50);
      expect(bytes.readUInt16LE(8)).toBe(8);
      const footer = bytes.length - 22;
      expect(bytes.readUInt32LE(footer)).toBe(0x06_05_4b_50);
      const directory = bytes.readUInt32LE(footer + 16);
      expect(bytes.readUInt32LE(directory)).toBe(0x02_01_4b_50);
      const compressedSize = bytes.readUInt32LE(directory + 20);
      const contentStart = 30 + bytes.readUInt16LE(26) + bytes.readUInt16LE(28);
      expect(
        inflateRawSync(
          bytes.subarray(contentStart, contentStart + compressedSize),
        ),
      ).toEqual(original);
      expect(bytes.readUInt32LE(directory + 24)).toBe(original.length);
    },
  );

  it('cancels a prepared snapshot instead of publishing it after reset', async () => {
    await expect(
      createLogArchive(new Blob(['old']), () => true),
    ).rejects.toThrow('cancelled');
  });
});
