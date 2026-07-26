/* cspell:ignore eocd */

import {
  canonicalizeTrustedFirmwareJson,
  generateTrustedFirmwareCatalog,
  inspectFirmwareZip,
  parseStrictFirmwareJson,
  renderTrustedFirmwareCatalogModule,
  sha256TrustedFirmwareJson,
} from './generateTrustedFirmwareCatalog';

import type {
  ITrustedFirmwareCatalogFetchResponse,
  ITrustedFirmwareCatalogFetcher,
} from './generateTrustedFirmwareCatalog';

const encoder = new TextEncoder();
const manifestUrl = 'https://data.example.com/config.json';
const artifactUrl = 'https://firmware.example.com/classic1s-4.0.0.bin';
const artifactBytes = encoder.encode('signed firmware bytes');

const createConfig = () => ({
  classic1s: {
    'firmware-v8': [
      {
        required: false,
        version: [4, 0, 0],
        url: artifactUrl,
      },
    ],
  },
});

const createResponse = ({
  status = 200,
  contentType = 'application/octet-stream',
  body,
  finalUrl,
}: {
  status?: number;
  contentType?: string;
  body: Uint8Array;
  finalUrl?: string;
}): ITrustedFirmwareCatalogFetchResponse => ({
  status,
  headers: { 'content-type': contentType },
  body,
  ...(finalUrl ? { finalUrl } : {}),
});

const createFetcher = (
  config: unknown = createConfig(),
  artifactResponse = createResponse({
    body: artifactBytes,
    finalUrl: artifactUrl,
  }),
): ITrustedFirmwareCatalogFetcher =>
  jest.fn(async (url) => {
    if (url === manifestUrl) {
      return createResponse({
        contentType: 'application/json; charset=utf-8',
        body: encoder.encode(JSON.stringify(config)),
        finalUrl: manifestUrl,
      });
    }
    if (url === artifactUrl) return artifactResponse;
    throw new Error(`Unexpected URL: ${url}`);
  });

const generate = (fetcher: ITrustedFirmwareCatalogFetcher = createFetcher()) =>
  generateTrustedFirmwareCatalog({
    catalogEpoch: 2_026_072_501,
    generatedAt: '2026-07-25T00:00:00.000Z',
    sources: [{ channel: 'stable', manifestUrl }],
    fetcher,
  });

describe('strict firmware JSON', () => {
  it('rejects duplicate object keys at any depth', () => {
    expect(() =>
      parseStrictFirmwareJson('{"classic1s":{"firmware":[],"firmware":[]}}'),
    ).toThrow('duplicate key firmware');
  });

  it('rejects malformed numbers and trailing data', () => {
    expect(() => parseStrictFirmwareJson('{"version":01}')).toThrow();
    expect(() => parseStrictFirmwareJson('{"version":1} false')).toThrow(
      'trailing data',
    );
  });
});

describe('trusted firmware canonical encoding', () => {
  it('is key-order independent and matches the SDK canonical digest golden', () => {
    const left = { b: ['\u2028', -0], a: { value: true } };
    const right = { a: { value: true }, b: ['\u2028', 0] };
    expect(canonicalizeTrustedFirmwareJson(left)).toBe(
      canonicalizeTrustedFirmwareJson(right),
    );
    expect(sha256TrustedFirmwareJson(left)).toBe(
      sha256TrustedFirmwareJson(right),
    );

    expect(sha256TrustedFirmwareJson(left)).toBe(
      '8b488f78466edf3e92c671536825112ec462e8c504e5cff5caa66f146017c7a3',
    );
  });
});

describe('generateTrustedFirmwareCatalog', () => {
  it('downloads decoded bytes and emits a validated external-only snapshot', async () => {
    const catalog = await generate();
    expect(catalog.snapshots).toHaveLength(1);
    const artifact = catalog.snapshots[0].snapshot.artifactCatalog[0];
    expect(artifact).toMatchObject({
      target: 'firmware',
      sourceUrls: [artifactUrl],
      expectedSize: artifactBytes.byteLength,
    });
    expect(artifact.expectedSha256).toHaveLength(64);
    expect(catalog.snapshots[0].sourceSelectionDigest).toBe(
      sha256TrustedFirmwareJson(createConfig().classic1s['firmware-v8']),
    );
    expect(catalog.catalogDigest).toBe(
      sha256TrustedFirmwareJson({
        schemaVersion: catalog.schemaVersion,
        catalogLineage: catalog.catalogLineage,
        catalogEpoch: catalog.catalogEpoch,
        generatedAt: catalog.generatedAt,
        sources: catalog.sources,
        snapshots: catalog.snapshots,
      }),
    );

    const snapshot = catalog.snapshots[0].snapshot;
    expect(snapshot.snapshotDigest).toBe(
      sha256TrustedFirmwareJson({
        schemaVersion: snapshot.schemaVersion,
        catalogEpoch: snapshot.catalogEpoch,
        source: snapshot.source,
        remoteConfigProjection: snapshot.remoteConfigProjection,
        artifactCatalog: snapshot.artifactCatalog,
        releases: snapshot.releases,
      }),
    );
    const rendered = renderTrustedFirmwareCatalogModule(catalog);
    expect(rendered).toContain('Review the complete diff');
    expect(rendered).toContain('trustedFirmwareCatalogMetadata');
    expect(rendered).toContain('trustedFirmwareCatalogSnapshotJsonByKey');
  });

  it('rejects an empty effective artifact URL', async () => {
    await expect(
      generate(
        createFetcher({
          classic1s: {
            'firmware-v8': [{ required: false, version: [4, 0, 0], url: '' }],
          },
        }),
      ),
    ).rejects.toThrow('must be a non-empty HTTPS URL');
  });

  it('rejects duplicate releases in the same selection', async () => {
    const release = {
      required: false,
      version: [4, 0, 0],
      url: artifactUrl,
    };
    await expect(
      generate(
        createFetcher({
          classic1s: {
            'firmware-v8': [release, { ...release }],
          },
        }),
      ),
    ).rejects.toThrow('duplicates release version 4.0.0');
  });

  it('rejects an unknown Pro2 component target', async () => {
    const components = {
      bootloader: { target: 'ROMLOADER', url: artifactUrl },
      applicationP1: { target: 'APPLICATION_P1', url: artifactUrl },
      applicationP2: { target: 'APPLICATION_P2', url: artifactUrl },
      coprocessor: { target: 'COPROCESSOR', url: artifactUrl },
      se01: { target: 'SE01', url: artifactUrl },
      se02: { target: 'SE02', url: artifactUrl },
      se03: { target: 'SE03', url: artifactUrl },
      se04: { target: 'SE04', url: artifactUrl },
    };
    await expect(
      generate(
        createFetcher({
          pro2: {
            'firmware-v1': [
              {
                required: false,
                version: [1, 0, 0],
                url: artifactUrl,
                upgradeType: 'payload-package-set',
                components,
                installOrder: Object.keys(components),
                resourceBundles: [],
              },
            ],
          },
        }),
      ),
    ).rejects.toThrow('unknown target ROMLOADER');
  });

  it('rejects an incomplete Pro2 resource bundle set', async () => {
    const components = {
      bootloader: { target: 'BOOTLOADER', url: artifactUrl },
      applicationP1: { target: 'APPLICATION_P1', url: artifactUrl },
      applicationP2: { target: 'APPLICATION_P2', url: artifactUrl },
      coprocessor: { target: 'COPROCESSOR', url: artifactUrl },
      se01: { target: 'SE01', url: artifactUrl },
      se02: { target: 'SE02', url: artifactUrl },
      se03: { target: 'SE03', url: artifactUrl },
      se04: { target: 'SE04', url: artifactUrl },
    };
    await expect(
      generate(
        createFetcher({
          pro2: {
            'firmware-v1': [
              {
                required: false,
                version: [1, 0, 0],
                url: artifactUrl,
                upgradeType: 'payload-package-set',
                components,
                installOrder: Object.keys(components),
                resourceBundles: [],
              },
            ],
          },
        }),
      ),
    ).rejects.toThrow('resourceBundles is incomplete');
  });

  it('fails closed when an artifact cannot be downloaded', async () => {
    await expect(
      generate(
        createFetcher(
          createConfig(),
          createResponse({
            status: 404,
            body: new Uint8Array(),
            finalUrl: artifactUrl,
          }),
        ),
      ),
    ).rejects.toThrow('returned HTTP 404');
  });

  it('rejects cross-host redirects even if the fetcher followed one', async () => {
    await expect(
      generate(
        createFetcher(
          createConfig(),
          createResponse({
            body: artifactBytes,
            finalUrl: 'https://attacker.example.com/firmware.bin',
          }),
        ),
      ),
    ).rejects.toThrow('redirected across hosts');
  });
});

describe('inspectFirmwareZip', () => {
  const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xed_b8_83_20 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });

  const getCrc32 = (bytes: Uint8Array) => {
    let value = 0xff_ff_ff_ff;
    bytes.forEach((byte) => {
      value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
    });
    return (value ^ 0xff_ff_ff_ff) >>> 0;
  };

  const createStoredZip = (entryId: string, data: Uint8Array) => {
    const name = encoder.encode(entryId);
    const local = Buffer.alloc(30 + name.byteLength + data.byteLength);
    local.writeUInt32LE(0x04_03_4b_50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(1 << 11, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(getCrc32(data), 14);
    local.writeUInt32LE(data.byteLength, 18);
    local.writeUInt32LE(data.byteLength, 22);
    local.writeUInt16LE(name.byteLength, 26);
    local.set(name, 30);
    local.set(data, 30 + name.byteLength);

    const central = Buffer.alloc(46 + name.byteLength);
    central.writeUInt32LE(0x02_01_4b_50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(1 << 11, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(getCrc32(data), 16);
    central.writeUInt32LE(data.byteLength, 20);
    central.writeUInt32LE(data.byteLength, 24);
    central.writeUInt16LE(name.byteLength, 28);
    central.set(name, 46);

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06_05_4b_50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(central.byteLength, 12);
    eocd.writeUInt32LE(local.byteLength, 16);
    return Buffer.concat([local, central, eocd]);
  };

  it('hashes decoded archive entry bytes', () => {
    const data = encoder.encode('decoded image');
    expect(
      inspectFirmwareZip(createStoredZip('images/logo.png', data)),
    ).toEqual([
      {
        entryId: 'images/logo.png',
        logicalName: 'logo.png',
        expectedSize: data.byteLength,
        expectedSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    ]);
  });

  it('rejects unsafe archive paths', () => {
    expect(() =>
      inspectFirmwareZip(createStoredZip('../logo.png', artifactBytes)),
    ).toThrow('unsafe path component');
  });
});
