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
  return {
    ok,
    status,
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
    expect(fetcher).toHaveBeenCalledWith(archiveUrl);
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
});
