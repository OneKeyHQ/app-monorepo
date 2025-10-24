import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  OneKeyLocalError,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  ELogUploadStage,
  type ILogDigest,
  type ILogUploadResponse,
} from '@onekeyhq/shared/src/logger/types';
import utils from '@onekeyhq/shared/src/logger/utils';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';

import { buildDefaultFileBaseName } from './utils';

const getShareModule = async () => {
  if (!platformEnv.isNative) return null;
  return (await import('@onekeyhq/shared/src/modules3rdParty/expo-sharing'))
    .default;
};

export const exportLogs = async (filename: string) => {
  defaultLogger.setting.device.logDeviceInfo();
  await waitAsync(1000);
  const logFilePath = await utils.getLogFilePath(filename);
  console.log('logFilePath', logFilePath);
  const Share = await getShareModule();
  if (!Share) return;
  Share.shareAsync(logFilePath, {
    dialogTitle: 'OneKey Logs',
    mimeType: 'application/zip',
    UTI: 'public.zip-archive',
  }).catch(() => {
    /** ignore */
  });
};

export const collectLogDigest = async (
  fileBaseName?: string,
): Promise<ILogDigest> => {
  appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
    stage: ELogUploadStage.Collecting,
    progressPercent: 0,
  });
  const baseName = fileBaseName ?? buildDefaultFileBaseName();
  defaultLogger.setting.device.logDeviceInfo();
  await waitAsync(1000);

  const filePath = await utils.getLogFilePath(baseName);
  if (!filePath) {
    throw new OneKeyLocalError('Failed to generate native log archive');
  }

  const normalizedPath = filePath.startsWith('file://')
    ? filePath.replace('file://', '')
    : filePath;

  const RNFS = (
    await import('@onekeyhq/shared/src/modules3rdParty/react-native-fs')
  ).default;
  if (!RNFS) {
    throw new OneKeyLocalError('RNFS is not available');
  }
  const stat = await RNFS.stat(normalizedPath);
  const sizeBytes = Number(stat.size ?? 0);
  const sha256 = await BundleUpdate.getSha256FromFilePath(normalizedPath);
  return {
    sizeBytes,
    sha256,
    bundle: {
      type: 'file',
      fileName: `${baseName}.zip`,
      mimeType: 'application/zip',
      filePath,
    },
  };
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
    throw new OneKeyLocalError('Native upload expects a file bundle');
  }

  const endpointInfo = await backgroundApiProxy.serviceApp.getEndpointInfo({
    name: EServiceEndpointEnum.Wallet,
  });
  const uploadUrl = `${endpointInfo.endpoint.replace(
    /\/$/,
    '',
  )}/wallet/v1/client/log`;

  const headers = await getRequestHeaders();
  headers.authorization = `Bearer ${uploadToken}`;
  // Clean up possible casing variants we do not want to forward
  delete headers['content-length'];
  delete headers['Content-Length'];

  appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
    stage: ELogUploadStage.Uploading,
    progressPercent: 0,
  });

  let httpStatus = 0;
  let text = '';

  let uploadTaskError: Error | undefined;
  let fileSystemModule: typeof import('expo-file-system') | undefined;
  try {
    fileSystemModule = await import('expo-file-system');
  } catch (error) {
    fileSystemModule = undefined;
  }

  if (fileSystemModule?.createUploadTask) {
    try {
      const uploadTask = fileSystemModule.createUploadTask(
        uploadUrl,
        digest.bundle.filePath,
        {
          headers: {
            ...headers,
            'content-type':
              digest.bundle.mimeType ?? 'application/octet-stream',
          },
          httpMethod: 'POST',
          uploadType: fileSystemModule.FileSystemUploadType.BINARY_CONTENT,
        },
        (progress) => {
          const total =
            typeof progress.totalBytesExpectedToSend === 'number' &&
            progress.totalBytesExpectedToSend > 0
              ? progress.totalBytesExpectedToSend
              : digest.sizeBytes;
          if (total > 0) {
            const percent = Math.min(
              100,
              Math.round((progress.totalBytesSent / total) * 100),
            );
            appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
              stage: ELogUploadStage.Uploading,
              progressPercent: percent,
            });
          }
        },
      );

      const result = await uploadTask.uploadAsync();
      if (!result) {
        throw new OneKeyLocalError('Upload cancelled');
      }
      httpStatus = result.status ?? 0;
      text = result.body ?? '';
    } catch (error) {
      uploadTaskError =
        error instanceof Error
          ? error
          : new OneKeyLocalError(String(error ?? 'Upload failed'));
    }
  } else {
    uploadTaskError = new OneKeyLocalError('Upload task is not available');
  }

  if (uploadTaskError) {
    const form = new FormData();
    form.append('file', {
      uri: digest.bundle.filePath,
      name: digest.bundle.fileName,
      type: digest.bundle.mimeType ?? 'application/octet-stream',
    } as any);

    const fallbackHeaders = {
      ...headers,
    };
    delete fallbackHeaders['content-type'];
    delete fallbackHeaders['Content-Type'];

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: fallbackHeaders as any,
        body: form,
      });
      httpStatus = response.status;
      text = await response.text();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? uploadTaskError.message);
      appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
        stage: ELogUploadStage.Error,
        message,
      });
      throw error;
    }
  }

  type IServerPayload =
    | IApiClientResponse<ILogUploadResponse>
    | {
        code: number;
        message?: string;
        data?: { message?: string };
      };
  let payload: IServerPayload | undefined;
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch (error) {
    payload = {
      code: httpStatus,
      message: text,
      data: undefined,
    };
  }

  if (!payload || typeof payload !== 'object') {
    appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
      stage: ELogUploadStage.Error,
      message: 'Upload failed: invalid response',
    });
    throw new OneKeyLocalError('Upload failed: invalid response');
  }

  if (typeof payload.code === 'number' && payload.code !== 0) {
    appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
      stage: ELogUploadStage.Error,
      message:
        (payload.data as { message?: string } | undefined)?.message ||
        payload.message ||
        'Upload failed',
    });
    throw new OneKeyServerApiError({
      message:
        (payload.data as { message?: string } | undefined)?.message ||
        payload.message ||
        'Upload failed',
      code: payload.code,
      data: payload,
    });
  }

  if (!payload.data) {
    appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
      stage: ELogUploadStage.Error,
      message: 'Upload failed: missing response data',
    });
    throw new OneKeyLocalError('Upload failed: missing response data');
  }

  appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
    stage: ELogUploadStage.Success,
    progressPercent: 100,
  });

  return {
    digest,
    result: payload.data as ILogUploadResponse,
  };
};
