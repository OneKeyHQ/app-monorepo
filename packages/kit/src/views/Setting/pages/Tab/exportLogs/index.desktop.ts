import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';

import { buildDefaultFileBaseName } from './utils';

import type { ILogDigest } from './types';

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

export const uploadLogBundle = async () => {
  throw new OneKeyLocalError('uploadLogBundle is not implemented for desktop');
};
