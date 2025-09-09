import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IExtraAgent,
  IFill,
  IHex,
  IUserFillsByTimeParameters,
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
      });
    }

    return this._infoClient;
  }

  @backgroundMethod()
  async getExtraAgents(params: { user: IHex }): Promise<IExtraAgent[]> {
    const infoClient = await this._ensureInfoClient();
    try {
      return await infoClient.extraAgents(params);
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to get extra agents: ${String(error)}`,
      );
    }
  }

  @backgroundMethod()
  async getMaxBuilderFee(params: {
    user: IHex;
    builder: IHex;
  }): Promise<number> {
    const infoClient = await this._ensureInfoClient();
    try {
      return await infoClient.maxBuilderFee(params);
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to get max builder fee: ${String(error)}`,
      );
    }
  }

  @backgroundMethod()
  async getUserFillsByTime(
    params: IUserFillsByTimeParameters,
  ): Promise<IFill[]> {
    const infoClient = await this._ensureInfoClient();
    try {
      return await infoClient.userFillsByTime(params);
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to get user fills by time: ${String(error)}`,
      );
    }
  }

  async dispose(): Promise<void> {
    this._infoClient = null;
  }
}
