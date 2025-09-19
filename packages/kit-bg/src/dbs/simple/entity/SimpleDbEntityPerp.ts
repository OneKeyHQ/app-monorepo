import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  HYPERLIQUID_AGENT_TTL_DEFAULT,
  HYPERLIQUID_REFERRAL_CODE,
} from '@onekeyhq/shared/src/consts/perp';
import type {
  IMarginTables,
  IPerpsUniverse,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IHyperliquidCustomSettings = {
  hideNavBar?: boolean;
  hideNavBarConnectButton?: boolean;
  hideNotOneKeyWalletConnectButton?: boolean;
  skipOrderConfirm?: boolean;
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
  tradingUniverse?: IPerpsUniverse[] | undefined;
  marginTables?: IMarginTables | undefined;
  agentTTL?: number; // in milliseconds
  referralCode?: string;
  tradingviewDisplayPriceScale?: Record<string, number>; // decimal places for price display in tradingview chart
}

export class SimpleDbEntityPerp extends SimpleDbEntityBase<ISimpleDbPerpData> {
  entityName = 'perp';

  override enableCache = true;

  @backgroundMethod()
  async getPerpData(): Promise<ISimpleDbPerpData> {
    const config = await this.getRawData();
    const result = config || {
      tradingUniverse: [],
      marginTables: [],
    };
    result.agentTTL = result.agentTTL ?? HYPERLIQUID_AGENT_TTL_DEFAULT;
    result.referralCode = result.referralCode ?? HYPERLIQUID_REFERRAL_CODE;
    result.hyperliquidCustomSettings = result.hyperliquidCustomSettings ?? {
      skipOrderConfirm: false,
    };
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
  async getMarginTables(): Promise<IMarginTables | undefined> {
    const config = await this.getPerpData();
    return config.marginTables;
  }

  @backgroundMethod()
  async setTradingUniverse({
    universe,
    marginTables,
  }: {
    universe: IPerpsUniverse[];
    marginTables: IMarginTables;
  }) {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        marginTables,
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
        hyperliquidCurrentToken: token,
      }),
    );
  }

  @backgroundMethod()
  async getPerpCustomSettings(): Promise<IHyperliquidCustomSettings> {
    const config = await this.getPerpData();
    return config.hyperliquidCustomSettings ?? {};
  }

  @backgroundMethod()
  async setPerpCustomSettings(settings: IHyperliquidCustomSettings) {
    await this.setPerpData(
      (prevConfig): ISimpleDbPerpData => ({
        ...prevConfig,
        hyperliquidCustomSettings: {
          ...(prevConfig?.hyperliquidCustomSettings ?? {}),
          ...settings,
        },
      }),
    );
  }

  async updateTradingviewDisplayPriceScale({
    symbol,
    priceScale,
  }: {
    symbol: string;
    priceScale: number;
  }) {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        tradingUniverse: prev?.tradingUniverse,
        marginTables: prev?.marginTables,
        tradingviewDisplayPriceScale: {
          ...(prev?.tradingviewDisplayPriceScale || {}),
          [symbol]: priceScale,
        },
      }),
    );
  }

  @backgroundMethod()
  async getTradingviewDisplayPriceScale(
    symbol: string,
  ): Promise<number | undefined> {
    const config = await this.getPerpData();
    return config.tradingviewDisplayPriceScale?.[symbol];
  }
}
