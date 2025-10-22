import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { buildDefaultFileBaseName } from './utils';

import type { ILogDigest, ILogUploadResponse } from './types';

const LOG_ARCHIVE_MIME_TYPE = 'application/zip';

export const collectLogDigest = async (
  fileBaseName?: string,
): Promise<ILogDigest> => {
  const baseName = fileBaseName ?? buildDefaultFileBaseName();
  defaultLogger.setting.device.logDeviceInfo();
  await waitAsync(100);
  const result = await globalThis.desktopApiProxy.dev.collectLoggerDigest({
    fileBaseName: baseName,
  });
  if (!result || !result.filePath) {
    throw new OneKeyLocalError('Failed to collect desktop log files');
  }
  return {
    sizeBytes: result.sizeBytes,
    sha256: result.sha256,
    bundle: {
      type: 'file',
      fileName: result.fileName ?? `${baseName}.zip`,
      mimeType: result.mimeType ?? LOG_ARCHIVE_MIME_TYPE,
      filePath: result.filePath,
    },
  };
};

export const exportLogs = async () => {
  defaultLogger.setting.device.logDeviceInfo();
  await waitAsync(50);
  void globalThis.desktopApiProxy.dev.openLoggerFile();
};

export const uploadLogBundle = async ({
  uploadToken,
  digest,
}: {
  uploadToken: string;
  digest: ILogDigest;
}): Promise<{ digest: ILogDigest; result: ILogUploadResponse }> => {
  if (!uploadToken) {
    throw new OneKeyLocalError('Upload token is required');
  }
  if (!digest || !digest.bundle || digest.sizeBytes <= 0) {
    throw new OneKeyLocalError('Log bundle is empty');
  }
  if (digest.bundle.type !== 'file') {
    throw new OneKeyLocalError('Desktop upload expects a file bundle');
  }

  const endpointInfo = await backgroundApiProxy.serviceApp.getEndpointInfo({
    name: EServiceEndpointEnum.Wallet,
  });
  const baseUrl = endpointInfo.endpoint.replace(/\/$/, '');
  const uploadUrl = `${baseUrl}/wallet/v1/client/log`;

  const headers = await getRequestHeaders();
  headers.authorization = `Bearer ${uploadToken}`;
  headers['content-type'] = digest.bundle.mimeType;
  headers['content-length'] = String(digest.sizeBytes);

  const response = await globalThis.desktopApiProxy.dev.uploadLoggerBundle({
    uploadUrl,
    filePath: digest.bundle.filePath,
    sizeBytes: digest.sizeBytes,
    headers,
  });

  if (!response || typeof response !== 'object') {
    throw new OneKeyLocalError('Upload failed: invalid response');
  }
  if ('code' in response && response.code !== 0) {
    throw new OneKeyLocalError(response.message ?? 'Upload failed');
  }

  return {
    digest,
    result: (response.data ?? {}) as ILogUploadResponse,
  };
};
