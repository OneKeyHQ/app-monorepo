import { uploadLogBundle } from '.';

import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import { BROWSER_LOG_MAX_BYTES } from '@onekeyhq/shared/src/logger/types';
import type { ILogDigest } from '@onekeyhq/shared/src/logger/types';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceApp: { getEndpointInfo: jest.fn() } },
}));
jest.mock('@onekeyhq/shared/src/appApiClient/appApiClient', () => ({
  appApiClient: { getClient: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true },
}));
jest.mock('@onekeyhq/shared/src/appCrypto', () => ({}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: { emit: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/logger/exportSupport', () => ({}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/bufferUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/promiseUtils', () => ({}));
jest.mock('./collectBrowserLogDigest', () => ({}));
jest.mock('./utils', () => ({}));

function bundle(size: number): ILogDigest {
  return {
    sizeBytes: size,
    sha256: 'synthetic-test-digest',
    bundle: {
      type: 'blob',
      blob: new Blob([new Uint8Array(size)], { type: 'application/zip' }),
      fileName: 'test.zip',
      mimeType: 'application/zip',
    },
  };
}

describe('browser log upload', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([BROWSER_LOG_MAX_BYTES, BROWSER_LOG_MAX_BYTES + 1024])(
    'uploads %i bytes unchanged even when packaging exceeds the retention budget',
    async (sizeBytes) => {
      const post = jest.fn().mockResolvedValue({
        data: {
          data: {
            objectKey: 'synthetic-test',
            uploadedBytes: sizeBytes,
            durationMs: 1,
          },
        },
      });
      jest
        .mocked(appApiClient.getClient)
        .mockResolvedValue({ post } as unknown as Awaited<
          ReturnType<typeof appApiClient.getClient>
        >);
      const digest = bundle(sizeBytes);
      await uploadLogBundle({ uploadToken: 'test-token', digest });
      expect(post).toHaveBeenCalledWith(
        '/wallet/v1/client/log',
        digest.bundle.type === 'blob' ? digest.bundle.blob : undefined,
        expect.any(Object),
      );
    },
  );
});
