import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import {
  OneKeyLocalError,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  ILogDigest,
  ILogUploadResponse,
} from '@onekeyhq/shared/src/logger/types';
import utils from '@onekeyhq/shared/src/logger/utils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
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

  const fileBuffer = await RNFS.readFile(normalizedPath, 'base64');
  const bytes = Buffer.from(fileBuffer, 'base64');
  const hashBytes = await appCrypto.hash.sha256(bufferUtils.toBuffer(bytes));
  const sha256 = bufferUtils.bytesToHex(hashBytes);

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
  // Let React Native set multi part boundary
  delete headers['content-type'];
  delete headers['Content-Type'];
  delete headers['content-length'];

  const form = new FormData();
  form.append('file', {
    uri: digest.bundle.filePath,
    name: digest.bundle.fileName,
    type: digest.bundle.mimeType ?? 'application/octet-stream',
  } as any);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: headers as any,
    body: form,
  });

  const text = await response.text();
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
      code: response.status,
      message: text,
      data: undefined,
    };
  }

  if (!payload || typeof payload !== 'object') {
    throw new OneKeyLocalError('Upload failed: invalid response');
  }

  if (typeof payload.code === 'number' && payload.code !== 0) {
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
    throw new OneKeyLocalError('Upload failed: missing response data');
  }

  return {
    digest,
    result: payload.data as ILogUploadResponse,
  };
};
