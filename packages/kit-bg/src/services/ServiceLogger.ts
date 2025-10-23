import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceLogger extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  maxLength = 1000;

  data: string[] = [];

  @backgroundMethod()
  async getAllMsg() {
    return Promise.resolve(this.data);
  }

  @backgroundMethod()
  async addMsg(message: string) {
    if (!platformEnv.isNative) {
      if (this.data.length >= this.maxLength) {
        this.data.shift();
      }
      this.data.push(message);
    }
    return Promise.resolve(true);
  }

  @backgroundMethod()
  async requestUploadToken(payload: { sizeBytes: number; sha256: string }) {
    if (payload.sizeBytes <= 0) {
      throw new OneKeyLocalError('Log bundle is empty');
    }
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const response = await client.post<
      IApiClientResponse<{ uploadToken: string; expiresAt: number }>
    >('/wallet/v1/client/log/token', payload);
    return response.data.data;
  }
}

export default ServiceLogger;
