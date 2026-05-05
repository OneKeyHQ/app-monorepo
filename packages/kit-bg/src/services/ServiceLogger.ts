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

  // Circular buffer: O(1) insert, O(n) read (read is infrequent)
  private buffer: string[] = [];

  private writeIndex = 0;

  private isFull = false;

  @backgroundMethod()
  async getAllMsg() {
    if (!this.isFull) {
      return Promise.resolve(this.buffer.slice(0, this.writeIndex));
    }
    // Return in chronological order: oldest → newest
    return Promise.resolve([
      ...this.buffer.slice(this.writeIndex),
      ...this.buffer.slice(0, this.writeIndex),
    ]);
  }

  @backgroundMethod()
  async addMsg(message: string) {
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      if (this.buffer.length < this.maxLength) {
        this.buffer.push(message);
      } else {
        this.buffer[this.writeIndex] = message;
        this.isFull = true;
      }
      this.writeIndex = (this.writeIndex + 1) % this.maxLength;
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
