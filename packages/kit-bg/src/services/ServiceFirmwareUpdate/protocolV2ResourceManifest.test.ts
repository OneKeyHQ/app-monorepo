import { prepareProtocolV2ResourceFiles } from './protocolV2ResourceManifest';

const manifestUrl = 'https://example.com/releases/pro2/manifest.json';

function createResponse({
  json,
  binary,
  ok = true,
  status = 200,
}: {
  json?: unknown;
  binary?: ArrayBuffer;
  ok?: boolean;
  status?: number;
}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(json),
    arrayBuffer: jest.fn().mockResolvedValue(binary ?? new ArrayBuffer(0)),
  };
}

describe('prepareProtocolV2ResourceFiles', () => {
  test('downloads the CI manifest files before delegating verification to the SDK', async () => {
    const manifest = {
      schema: 1,
      files: [
        { archive_path: 'bundles/images/images.okpkg' },
        { archive_path: 'loaders/bootloader/boot_resource.okpkg' },
      ],
    };
    const binaries = [new Uint8Array([1]).buffer, new Uint8Array([2]).buffer];
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(createResponse({ json: manifest }))
      .mockResolvedValueOnce(createResponse({ binary: binaries[0] }))
      .mockResolvedValueOnce(createResponse({ binary: binaries[1] }));
    const prepared = [
      {
        binary: binaries[0],
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
        manifestUrl,
        targetsToUpdate: ['resource'],
        fetcher,
      }),
    ).resolves.toEqual(prepared);
    expect(fetcher).toHaveBeenNthCalledWith(1, manifestUrl);
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'https://example.com/releases/pro2/bundles/images/images.okpkg',
    );
    expect(hardwareSDK.prepareProtocolV2ResourceFiles).toHaveBeenCalledWith({
      manifest,
      files: [
        { archivePath: manifest.files[0].archive_path, binary: binaries[0] },
        { archivePath: manifest.files[1].archive_path, binary: binaries[1] },
      ],
      targetsToUpdate: ['resource'],
    });
  });

  test('does not download a manifest when no resource target is selected', async () => {
    const fetcher = jest.fn();
    const hardwareSDK = {
      prepareProtocolV2ResourceFiles: jest.fn(),
    };

    await expect(
      prepareProtocolV2ResourceFiles({
        hardwareSDK,
        manifestUrl: '',
        targetsToUpdate: ['app_v1'],
        fetcher,
      }),
    ).resolves.toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });

  test('rejects an unsafe archive path before downloading package files', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(
      createResponse({
        json: { schema: 1, files: [{ archive_path: '../outside.okpkg' }] },
      }),
    );

    await expect(
      prepareProtocolV2ResourceFiles({
        hardwareSDK: { prepareProtocolV2ResourceFiles: jest.fn() },
        manifestUrl,
        targetsToUpdate: ['boot_resources'],
        fetcher,
      }),
    ).rejects.toThrow('archive path');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
