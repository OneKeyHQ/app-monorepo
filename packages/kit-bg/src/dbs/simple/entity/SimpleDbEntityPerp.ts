import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  HYPERLIQUID_AGENT_TTL_DEFAULT,
  HYPERLIQUID_REFERRAL_CODE,
} from '@onekeyhq/shared/src/consts/perp';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IHyperliquidCustomSettings = {
  hideNavBar?: boolean;
  hideNavBarConnectButton?: boolean;
  hideNotOneKeyWalletConnectButton?: boolean;
};
export interface ISimpleDbPerpData {
  hyperliquidBuilderAddress?: string;
  hyperliquidMaxBuilderFee?: number;
  hyperliquidCustomSettings?: IHyperliquidCustomSettings;
  hyperliquidCustomLocalStorage?: Record<string, any>;
  hyperliquidCustomLocalStorageV2?: Record<
    string,
    {
      value: any;
      skipIfExists?: boolean;
    }
  >;
  hyperliquidCurrentToken?: string;
  tradingUniverse: IPerpsUniverse[] | undefined;
  agentTTL?: number; // in milliseconds
  referralCode?: string;
}

export class SimpleDbEntityPerp extends SimpleDbEntityBase<ISimpleDbPerpData> {
  entityName = 'perp';

  override enableCache = true;

  @backgroundMethod()
  async getPerpData(): Promise<ISimpleDbPerpData> {
    const config = await this.getRawData();
    const result = config || {
      tradingUniverse: [],
    };
    result.agentTTL = result.agentTTL ?? HYPERLIQUID_AGENT_TTL_DEFAULT;
    result.referralCode = result.referralCode ?? HYPERLIQUID_REFERRAL_CODE;
    return result;
  }

  @backgroundMethod()
  async setPerpData(
    setFn: (
      prevConfig: ISimpleDbPerpData | null | undefined,
    ) => ISimpleDbPerpData,
  ) {
    await this.setRawData(setFn);
  }

  @backgroundMethod()
  async getTradingUniverse(): Promise<IPerpsUniverse[] | undefined> {
    const config = await this.getPerpData();
    return config.tradingUniverse;
  }

  @backgroundMethod()
  async setTradingUniverse(universe: IPerpsUniverse[]) {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        tradingUniverse: universe,
      }),
    );
  }

  @backgroundMethod()
  async getExpectBuilderAddress(): Promise<string | undefined> {
    const config = await this.getPerpData();
    return config.hyperliquidBuilderAddress;
  }

  @backgroundMethod()
  async getExpectMaxBuilderFee(): Promise<number | undefined> {
    const config = await this.getPerpData();
    return config.hyperliquidMaxBuilderFee;
  }

  @backgroundMethod()
  async getCurrentToken(): Promise<string> {
    const config = await this.getPerpData();
    return config.hyperliquidCurrentToken || 'ETH';
  }

  @backgroundMethod()
  async setCurrentToken(token: string) {
    await this.setPerpData(
      (prevConfig): ISimpleDbPerpData => ({
        ...prevConfig,
        tradingUniverse: prevConfig?.tradingUniverse,
        hyperliquidCurrentToken: token,
      }),
    );
  }
}
