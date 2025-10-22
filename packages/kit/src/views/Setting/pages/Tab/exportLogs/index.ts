import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';

import { buildDefaultFileBaseName } from './utils';

import type { ILogDigest, ILogUploadResponse } from './types';

const LOG_MIME_TYPE = 'text/plain';
const LOG_FILE_EXTENSION = 'txt';
const EMPTY_SHA256_HEX =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export const collectLogDigest = async (
  fileBaseName?: string,
): Promise<ILogDigest> => {
  const baseName = fileBaseName ?? buildDefaultFileBaseName();
  defaultLogger.setting.device.logDeviceInfo();
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
  const endpointInfo = await backgroundApiProxy.serviceApp.getEndpointInfo({
    name: EServiceEndpointEnum.Wallet,
  });
  const client = await appApiClient.getClient(endpointInfo);
  const response = await client.post<IApiClientResponse<ILogUploadResponse>>(
    '/wallet/v1/client/log',
    digest.bundle.blob,
    {
      headers: {
        Authorization: `Bearer ${uploadToken}`,
        'Content-Type': digest.bundle.mimeType,
      },
    },
  );
  return {
    digest,
    result: response.data.data,
  };
};
