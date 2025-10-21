import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';

const LOG_MIME_TYPE = 'text/plain';
const LOG_FILE_EXTENSION = 'txt';
const EMPTY_SHA256_HEX =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export type IWebLogBundle = {
  type: 'text';
  fileName: string;
  mimeType: string;
  blob: Blob;
  content: string;
};

export type IWebLogDigest = {
  sizeBytes: number;
  sha256: string;
  bundle: IWebLogBundle;
};

const buildDefaultFileBaseName = () =>
  `OneKeyLogs-${new Date().toISOString().replace(/[-:.]/g, '')}`;

export const collectWebLogDigest = async (
  fileBaseName?: string,
): Promise<IWebLogDigest> => {
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
  const digest = await collectWebLogDigest(filename);
  const element = document.createElement('a');
  element.href = URL.createObjectURL(digest.bundle.blob);
  element.download = digest.bundle.fileName;
  document.body.appendChild(element); // Required for this to work in FireFox
  element.click();
  element.remove();
};

export type IWebLogUploadResponse = {
  objectKey: string;
  uploadedBytes: number;
  durationMs: number;
};

export const uploadWebLogs = async ({
  uploadToken,
  digest,
}: {
  uploadToken: string;
  digest: IWebLogDigest;
}): Promise<{ digest: IWebLogDigest; result: IWebLogUploadResponse }> => {
  if (!uploadToken) {
    throw new OneKeyLocalError('Upload token is required');
  }
  if (!digest || !digest.bundle || digest.sizeBytes <= 0) {
    throw new OneKeyLocalError('Log bundle is empty');
  }
  const endpointInfo = await backgroundApiProxy.serviceApp.getEndpointInfo({
    name: EServiceEndpointEnum.Wallet,
  });
  const client = await appApiClient.getClient(endpointInfo);
  const response = await client.post<IApiClientResponse<IWebLogUploadResponse>>(
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
