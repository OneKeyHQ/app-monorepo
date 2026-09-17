import { ReactNativeRangeDownloader } from '@onekeyfe/react-native-range-downloader';

import { firmwareArtifactAdapter } from './FirmwareArtifactAdapter.native';

jest.mock('@onekeyfe/react-native-range-downloader', () => ({
  ReactNativeRangeDownloader: {
    materializeFirmwareArchive: jest.fn(),
  },
}));

describe('native firmware artifact adapter', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('materializes a manifest-free archive without an expected entry catalog', async () => {
    const artifacts = [
      {
        entryName: 'bundles/images-release.okpkg',
        receipt: {
          artifactRef: `fw:${'1'.repeat(64)}`,
          size: 1024,
          sha256: '1'.repeat(64),
          expectedSha256Verified: false,
        },
      },
      {
        entryName: 'resource_hash.txt',
        receipt: {
          artifactRef: `fw:${'2'.repeat(64)}`,
          size: 64,
          sha256: '2'.repeat(64),
          expectedSha256Verified: false,
        },
      },
    ];
    const materializeFirmwareArchiveSpy = jest
      .spyOn(ReactNativeRangeDownloader, 'materializeFirmwareArchive')
      .mockResolvedValue({ artifacts });

    await expect(
      firmwareArtifactAdapter.materialize({
        leaseRef: 'fwlease:manifest-free-resc',
        archiveArtifactRef: `fw:${'3'.repeat(64)}`,
      }),
    ).resolves.toEqual(artifacts);
    expect(materializeFirmwareArchiveSpy).toHaveBeenCalledWith({
      leaseRef: 'fwlease:manifest-free-resc',
      archiveArtifactRef: `fw:${'3'.repeat(64)}`,
    });
  });
});
