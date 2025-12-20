import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  ELogUploadStage,
  type ILogDigest,
  type ILogUploadResponse,
} from '@onekeyhq/shared/src/logger/types';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';

import { buildDefaultFileBaseName } from './utils';

const LOG_MIME_TYPE = 'text/plain';
const LOG_FILE_EXTENSION = 'txt';
const EMPTY_SHA256_HEX =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export const collectLogDigest = async (
  fileBaseName?: string,
): Promise<ILogDigest> => {
  appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
    stage: ELogUploadStage.Collecting,
    progressPercent: 0,
  });
  const baseName = fileBaseName ?? buildDefaultFileBaseName();
  defaultLogger.setting.device.logDeviceInfo();
  try {
    const connectionInfo =
      await backgroundApiProxy.serviceIpTable.getConnectionInfo();
    defaultLogger.ipTable.request.info({
      info: `[IpTable] Connection info: type=${connectionInfo.type}, domain=${
        connectionInfo.domain
      }, ip=${connectionInfo.ip ?? 'N/A'}, sniSupported=${String(
        connectionInfo.sniSupported,
      )}`,
    });
  } catch (error) {
    defaultLogger.ipTable.request.warn({
      info: `[IpTable] Failed to get connection info: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    });
  }
  await waitAsync(1000);
  const messages = await backgroundApiProxy.serviceLogger.getAllMsg();
  const content = messages.join('');
  const blob = new Blob(messages, {
    type: LOG_MIME_TYPE,
    endings: 'native',
  });
  const arrayBuffer = await blob.arrayBuffer();
  const byteBuffer = bufferUtils.toBuffer(new Uint8Array(arrayBuffer));
  const sizeBytes = byteBuffer.length;
  const hashHex =
    sizeBytes > 0
      ? bufferUtils.bytesToHex(await appCrypto.hash.sha256(byteBuffer))
      : EMPTY_SHA256_HEX;
  return {
    sizeBytes,
    sha256: hashHex,
    bundle: {
      type: 'text',
      fileName: `${baseName}.${LOG_FILE_EXTENSION}`,
      mimeType: LOG_MIME_TYPE,
      blob,
      content,
    },
  };
};

export const exportLogs = async (filename?: string) => {
  const digest = await collectLogDigest(filename);
  if (digest.bundle.type !== 'text') {
    throw new OneKeyLocalError('Cannot export non-text log bundle');
  }
  const element = document.createElement('a');
  element.href = URL.createObjectURL(digest.bundle.blob);
  element.download = digest.bundle.fileName;
  document.body.appendChild(element); // Required for this to work in FireFox
  element.click();
  element.remove();
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
  if (digest.bundle.type !== 'text') {
    throw new OneKeyLocalError(
      'File-based log bundle is not supported on this platform',
    );
  }
  appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
    stage: ELogUploadStage.Uploading,
    progressPercent: 0,
  });
  const endpointInfo = await backgroundApiProxy.serviceApp.getEndpointInfo({
    name: EServiceEndpointEnum.Wallet,
  });
  const client = await appApiClient.getClient(endpointInfo);
  try {
    const response = await client.post<IApiClientResponse<ILogUploadResponse>>(
      '/wallet/v1/client/log',
      digest.bundle.blob,
      {
        headers: {
          Authorization: `Bearer ${uploadToken}`,
          'Content-Type': digest.bundle.mimeType,
        },
        onUploadProgress: (event) => {
          appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
            stage: ELogUploadStage.Uploading,
            progressPercent:
              typeof event.total === 'number' && event.total > 0
                ? Math.min(100, Math.round((event.loaded / event.total) * 100))
                : undefined,
          });
        },
      },
    );
    appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
      stage: ELogUploadStage.Success,
      progressPercent: 100,
    });
    return {
      digest,
      result: response.data.data,
    };
  } catch (error) {
    appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
      stage: ELogUploadStage.Error,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
