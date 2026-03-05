/* eslint-disable no-continue */

import { KEYLESS_SYNC_SIGNATURE_HEADER } from '@onekeyhq/shared/src/consts/keylessCloudSyncConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import type {
  ICloudSyncCheckServerStatusPostData,
  ICloudSyncCheckServerStatusResult,
  ICloudSyncDownloadPostData,
  ICloudSyncDownloadResult,
  ICloudSyncUploadPostData,
  ICloudSyncUploadResult,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import type { AxiosInstance, AxiosResponse } from 'axios';

class KeylessCloudSyncApi {
  private async postToServer<T>({
    client,
    url,
    signatureHeader,
    postData,
  }: {
    client: AxiosInstance;
    url: string;
    signatureHeader: string;
    postData: unknown;
  }): Promise<AxiosResponse<IApiClientResponse<T>, any>> {
    try {
      const response = await client.post<IApiClientResponse<T>>(url, postData, {
        headers: {
          // x-onekey-keyless-sync-signature already contains publicKey, no need for separate header
          [KEYLESS_SYNC_SIGNATURE_HEADER]: signatureHeader,
        },
      });
      return response;
    } catch (error) {
      console.warn(
        '[CloudSyncAPI] Cloud sync server unavailable, fallback to memory.',
        {
          url,
          error,
        },
      );
      throw error;
    }
  }

  async upload(params: {
    client: AxiosInstance;
    urlPath: string;
    signatureHeader: string;
    postData: ICloudSyncUploadPostData;
  }): Promise<AxiosResponse<IApiClientResponse<ICloudSyncUploadResult>, any>> {
    return this.postToServer<ICloudSyncUploadResult>({
      client: params.client,
      url: params.urlPath,
      signatureHeader: params.signatureHeader,
      postData: params.postData,
    });
  }

  async checkStatus(params: {
    client: AxiosInstance;
    signatureHeader: string;
    postData: ICloudSyncCheckServerStatusPostData;
  }): Promise<
    AxiosResponse<IApiClientResponse<ICloudSyncCheckServerStatusResult>, any>
  > {
    return this.postToServer<ICloudSyncCheckServerStatusResult>({
      client: params.client,
      url: '/prime/v1/sync/check',
      signatureHeader: params.signatureHeader,
      postData: params.postData,
    });
  }

  async download(params: {
    client: AxiosInstance;
    signatureHeader?: string;
    postData: ICloudSyncDownloadPostData;
  }): Promise<
    AxiosResponse<IApiClientResponse<ICloudSyncDownloadResult>, any>
  > {
    if (params.signatureHeader) {
      return this.postToServer<ICloudSyncDownloadResult>({
        client: params.client,
        url: '/prime/v1/sync/download',
        signatureHeader: params.signatureHeader,
        postData: params.postData,
      });
    }

    throw new OneKeyLocalError('Signature header is not set');
  }

  async clear(params: {
    client: AxiosInstance;
    signatureHeader: string;
  }): Promise<void> {
    await this.postToServer<{ cleared: boolean }>({
      client: params.client,
      url: '/prime/v1/sync/clear',
      signatureHeader: params.signatureHeader,
      postData: {},
    });
  }
}

export const keylessCloudSyncApi = new KeylessCloudSyncApi();
