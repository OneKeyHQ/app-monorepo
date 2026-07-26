import fs from 'fs';
import path from 'path';

import {
  isCanonicalPortableArchiveName,
  validateFirmwareArchiveEntries,
} from './DesktopApiFirmwareArtifact';

import type { IFirmwareArchiveEntryFacts } from './DesktopApiFirmwareArtifact';

jest.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/onekey-firmware-artifact-unit-test',
  },
}));

type IPathFixtures = {
  schemaVersion: number;
  singleNames: Array<{
    name: string;
    allowed: boolean;
    reason: string;
  }>;
  collisionSets: Array<{
    names: string[];
    allowed: boolean;
    reason: string;
  }>;
};

const fixtures = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '__fixtures__', 'firmwareZipPathFixtures.json'),
    'utf8',
  ),
) as IPathFixtures;

const regularEntry = (
  name: string,
  overrides: Partial<IFirmwareArchiveEntryFacts> = {},
): IFirmwareArchiveEntryFacts => ({
  name,
  compressedSize: 8,
  uncompressedSize: 16,
  compressionMethod: 8,
  generalPurposeBitFlag: 0,
  versionMadeBy: 3 << 8,
  externalFileAttributes: (0x81_a4 << 16) >>> 0,
  ...overrides,
});

const allow = (archiveName: string) => ({
  archiveName,
  artifactId: `entry-${archiveName}`,
  expectedSize: 16,
  expectedSha256: 'ab'.repeat(32),
});

describe('Desktop firmware archive rules', () => {
  test('matches the shared Native portable-path fixtures', () => {
    expect(fixtures.schemaVersion).toBe(1);
    fixtures.singleNames.forEach((fixture) => {
      expect({
        name: fixture.name,
        reason: fixture.reason,
        allowed: isCanonicalPortableArchiveName(fixture.name),
      }).toEqual(fixture);
    });
  });

  test('rejects normalization and case-folding collisions', () => {
    fixtures.collisionSets.forEach((fixture) => {
      expect(() =>
        validateFirmwareArchiveEntries({
          entries: fixture.names.map((name) => regularEntry(name)),
          allowList: fixture.names.map(allow),
        }),
      ).toThrow();
    });
  });

  test('accepts only exact, regular, unencrypted allow-listed entries', () => {
    expect(
      validateFirmwareArchiveEntries({
        entries: [regularEntry('firmware/main.bin')],
        allowList: [allow('firmware/main.bin')],
      }),
    ).toHaveLength(1);

    expect(() =>
      validateFirmwareArchiveEntries({
        entries: [
          regularEntry('firmware/main.bin', {
            generalPurposeBitFlag: 1,
          }),
        ],
        allowList: [allow('firmware/main.bin')],
      }),
    ).toThrow('unsupported');

    expect(() =>
      validateFirmwareArchiveEntries({
        entries: [
          regularEntry('firmware/main.bin', {
            externalFileAttributes: (0xa1_ff << 16) >>> 0,
          }),
        ],
        allowList: [allow('firmware/main.bin')],
      }),
    ).toThrow('unsupported');
  });
});
