import {
  InfoClient,
  HttpTransport,
} from '@nktkas/hyperliquid';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  ExtraAgent,
  UserFillsByTimeParameters,
  Fill,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import ServiceBase from '../ServiceBase';

@backgroundClass()
export default class ServiceHyperliquidInfo extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private _infoClient: InfoClient | null = null;

  private async _ensureInfoClient(): Promise<InfoClient> {
    if (!this._infoClient) {
      const transport = new HttpTransport();

      this._infoClient = new InfoClient({
        transport,
      }) as InfoClient;
    }

    return this._infoClient;
  }

  @backgroundMethod()
  async getExtraAgents(params: { user: `0x${string}` }): Promise<ExtraAgent[]> {
    try {
      const infoClient = await this._ensureInfoClient();
      return await infoClient.extraAgents(params);
    } catch (error) {
      throw new OneKeyLocalError(`Failed to get extra agents: ${error}`);
    }
  }

  @backgroundMethod()
  async getMaxBuilderFee(params: {
    user: `0x${string}`;
    builder: `0x${string}`;
  }): Promise<number> {
    try {
      const infoClient = await this._ensureInfoClient();
      return await infoClient.maxBuilderFee(params);
    } catch (error) {
      throw new OneKeyLocalError(`Failed to get max builder fee: ${error}`);
    }
  }

  @backgroundMethod()
  async getUserFillsByTime(params: UserFillsByTimeParameters): Promise<Fill[]> {
    try {
      const infoClient = await this._ensureInfoClient();
      return await infoClient.userFillsByTime(params);
    } catch (error) {
      throw new OneKeyLocalError(`Failed to get user fills by time: ${error}`);
    }
  }

  async dispose(): Promise<void> {
    this._infoClient = null;
  }
}
