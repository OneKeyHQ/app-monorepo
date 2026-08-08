import { strToU8, zipSync } from 'fflate';

import appCrypto from '@onekeyhq/shared/src/appCrypto';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { prepareProtocolV2ResourceFiles } from './protocolV2ResourceArchive';

const archiveUrl = 'https://example.com/releases/pro2/resource.zip';

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

function createResponse({
  binary,
  ok = true,
  status = 200,
}: {
  binary?: ArrayBuffer;
  ok?: boolean;
  status?: number;
}) {
  const contentLength = binary?.byteLength ?? 0;
  return {
    ok,
    status,
    headers: {
      get: jest.fn((name: string) =>
        name === 'content-length' ? String(contentLength) : null,
      ),
    },
    arrayBuffer: jest.fn().mockResolvedValue(binary ?? new ArrayBuffer(0)),
  };
}

async function createArchiveSource(binary: ArrayBuffer) {
  return {
    archiveUrl,
    archiveSha256: bufferUtils.bytesToHex(
      await appCrypto.hash.sha256(bufferUtils.toBuffer(binary)),
    ),
    archiveSize: binary.byteLength,
  };
}

describe('prepareProtocolV2ResourceFiles', () => {
  test('downloads and verifies one CI archive before delegating file verification to the SDK', async () => {
    const manifest = {
      schema: 1,
      files: [
        { archive_path: 'bundles/images/images.okpkg' },
        { archive_path: 'loaders/bootloader/boot_resource.okpkg' },
      ],
    };
    const archiveBinary = toArrayBuffer(
      zipSync({
        'manifest.json': strToU8(JSON.stringify(manifest)),
        'bundles/images/images.okpkg': new Uint8Array([1]),
        'loaders/bootloader/boot_resource.okpkg': new Uint8Array([2]),
      }),
    );
    const archive = await createArchiveSource(archiveBinary);
    const fetcher = jest
      .fn()
      .mockResolvedValue(createResponse({ binary: archiveBinary }));
    const prepared = [
      {
        binary: new Uint8Array([1]).buffer,
        devicePath: 'vol0:/bundles/images/images.okpkg',
        size: 1,
        fileHash: 'a'.repeat(64),
      },
    ];
    const hardwareSDK = {
      prepareProtocolV2ResourceFiles: jest.fn().mockReturnValue(prepared),
    };

    await expect(
      prepareProtocolV2ResourceFiles({
        hardwareSDK,
        archive,
        targetsToUpdate: ['resource'],
        fetcher,
      }),
    ).resolves.toEqual(prepared);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(archiveUrl, {
      signal: expect.any(AbortSignal),
    });
    expect(hardwareSDK.prepareProtocolV2ResourceFiles).toHaveBeenCalledWith({
      manifest,
      files: [
        {
          archivePath: manifest.files[0].archive_path,
          binary: expect.any(ArrayBuffer),
        },
        {
          archivePath: manifest.files[1].archive_path,
          binary: expect.any(ArrayBuffer),
        },
      ],
      targetsToUpdate: ['resource'],
    });
  });

  test('does not download an archive when no resource target is selected', async () => {
    const fetcher = jest.fn();
    const hardwareSDK = {
      prepareProtocolV2ResourceFiles: jest.fn(),
    };

    await expect(
      prepareProtocolV2ResourceFiles({
        hardwareSDK,
        archive: undefined,
        targetsToUpdate: ['app_v1'],
        fetcher,
      }),
    ).resolves.toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });

  test('rejects an archive whose SHA-256 does not match pre-config', async () => {
    const archiveBinary = toArrayBuffer(
      zipSync({ 'manifest.json': strToU8('{"schema":1,"files":[]}') }),
    );
    const fetcher = jest
      .fn()
      .mockResolvedValue(createResponse({ binary: archiveBinary }));

    await expect(
      prepareProtocolV2ResourceFiles({
        hardwareSDK: { prepareProtocolV2ResourceFiles: jest.fn() },
        archive: {
          archiveUrl,
          archiveSha256: 'a'.repeat(64),
          archiveSize: archiveBinary.byteLength,
        },
        targetsToUpdate: ['resource'],
        fetcher,
      }),
    ).rejects.toThrow('SHA-256 mismatch');
  });

  test('rejects an unsafe manifest archive path after extracting the verified archive', async () => {
    const archiveBinary = toArrayBuffer(
      zipSync({
        'manifest.json': strToU8(
          JSON.stringify({
            schema: 1,
            files: [{ archive_path: '../outside.okpkg' }],
          }),
        ),
      }),
    );
    const fetcher = jest
      .fn()
      .mockResolvedValue(createResponse({ binary: archiveBinary }));

    await expect(
      prepareProtocolV2ResourceFiles({
        hardwareSDK: { prepareProtocolV2ResourceFiles: jest.fn() },
        archive: await createArchiveSource(archiveBinary),
        targetsToUpdate: ['resource'],
        fetcher,
      }),
    ).rejects.toThrow('archive path');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('rejects an oversized configured archive before downloading it', async () => {
    const fetcher = jest.fn();

    await expect(
      prepareProtocolV2ResourceFiles({
        hardwareSDK: { prepareProtocolV2ResourceFiles: jest.fn() },
        archive: {
          archiveUrl,
          archiveSha256: 'a'.repeat(64),
          archiveSize: 64 * 1024 * 1024 + 1,
        },
        targetsToUpdate: ['resource'],
        fetcher,
      }),
    ).rejects.toThrow('Invalid Protocol V2 resource archive size');
    expect(fetcher).not.toHaveBeenCalled();
  });

  test('aborts a resource archive download after the deadline', async () => {
    const fetcher = jest.fn<
      Promise<never>,
      [string, { signal?: AbortSignal }?]
    >(() => new Promise<never>(() => undefined));

    await expect(
      prepareProtocolV2ResourceFiles({
        hardwareSDK: { prepareProtocolV2ResourceFiles: jest.fn() },
        archive: {
          archiveUrl,
          archiveSha256: 'a'.repeat(64),
          archiveSize: 1,
        },
        targetsToUpdate: ['resource'],
        fetcher,
        downloadTimeoutMs: 1,
      }),
    ).rejects.toThrow('download timed out');
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  test('stops a streaming response before it exceeds the configured size', async () => {
    const cancel = jest.fn().mockResolvedValue(undefined);
    const arrayBuffer = jest.fn();
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: jest.fn().mockResolvedValue({
            done: false,
            value: new Uint8Array([1, 2]),
          }),
          cancel,
        }),
      },
      arrayBuffer,
    });

    await expect(
      prepareProtocolV2ResourceFiles({
        hardwareSDK: { prepareProtocolV2ResourceFiles: jest.fn() },
        archive: {
          archiveUrl,
          archiveSha256: 'a'.repeat(64),
          archiveSize: 1,
        },
        targetsToUpdate: ['resource'],
        fetcher,
      }),
    ).rejects.toThrow('archive size mismatch');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  test('rejects an archive with too many entries before extracting resources', async () => {
    const entries: Record<string, Uint8Array> = {
      'manifest.json': strToU8(
        JSON.stringify({
          schema: 1,
          files: [{ archive_path: 'bundles/images/images.okpkg' }],
        }),
      ),
      'bundles/images/images.okpkg': new Uint8Array([1]),
    };
    for (let index = 0; index < 512; index += 1) {
      entries[`unused/${index}.bin`] = new Uint8Array([index % 255]);
    }
    const archiveBinary = toArrayBuffer(zipSync(entries));
    const fetcher = jest
      .fn()
      .mockResolvedValue(createResponse({ binary: archiveBinary }));

    await expect(
      prepareProtocolV2ResourceFiles({
        hardwareSDK: { prepareProtocolV2ResourceFiles: jest.fn() },
        archive: await createArchiveSource(archiveBinary),
        targetsToUpdate: ['resource'],
        fetcher,
      }),
    ).rejects.toThrow('contains too many files');
  });
});
