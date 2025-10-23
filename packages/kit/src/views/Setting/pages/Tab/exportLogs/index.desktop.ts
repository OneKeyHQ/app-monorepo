import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  OneKeyLocalError,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';
import type {
  ILogDigest,
  ILogUploadResponse,
} from '@onekeyhq/shared/src/logger/types';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { buildDefaultFileBaseName } from './utils';

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

  appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
    stage: ELogUploadStage.Uploading,
    progressPercent: 0,
  });
  const removeProgressListener =
    typeof globalThis.desktopApi?.on === 'function'
      ? globalThis.desktopApi.on(
          ipcMessageKeys.CLIENT_LOG_UPLOAD_PROGRESS,
          (payload: {
            stage: ELogUploadStage;
            progressPercent?: number;
            retry?: number;
            message?: string;
          }) => {
            appEventBus.emit(
              EAppEventBusNames.ClientLogUploadProgress,
              payload,
            );
          },
        )
      : undefined;

  if (!removeProgressListener) {
    appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
      stage: ELogUploadStage.Uploading,
      progressPercent: 0,
    });
  }

  try {
    const response = await globalThis.desktopApiProxy.dev.uploadLoggerBundle({
      uploadUrl,
      filePath: digest.bundle.filePath,
      sizeBytes: digest.sizeBytes,
      headers,
    });

    if (!response || typeof response !== 'object') {
      throw new OneKeyLocalError('Upload failed: invalid response');
    }

    const responseData = response as IApiClientResponse<ILogUploadResponse> &
      Record<string, any>;

    if (typeof responseData.code === 'number' && responseData.code !== 0) {
      const errorMessage =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (responseData?.data as any)?.message ||
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (responseData as any)?.message ||
        'Upload failed';
      throw new OneKeyServerApiError({
        message: errorMessage,
        data: responseData as any,
        code: responseData.code,
      });
    }

    if (!responseData.data) {
      appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
        stage: ELogUploadStage.Error,
        message: 'Upload failed: missing response data',
      });
      throw new OneKeyLocalError('Upload failed: missing response data');
    }

    const result = {
      digest,
      result: responseData.data,
    };
    if (!removeProgressListener) {
      appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
        stage: ELogUploadStage.Success,
        progressPercent: 100,
      });
    }
    return result;
  } catch (error) {
    if (!removeProgressListener) {
      appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
        stage: ELogUploadStage.Error,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  } finally {
    removeProgressListener?.();
  }
};
