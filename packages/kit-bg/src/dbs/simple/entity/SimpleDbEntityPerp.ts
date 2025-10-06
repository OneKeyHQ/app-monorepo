import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  HYPERLIQUID_AGENT_TTL_DEFAULT,
  HYPERLIQUID_REFERRAL_CODE,
} from '@onekeyhq/shared/src/consts/perp';
import type {
  IMarginTableMap as IMarginTablesMap,
  IPerpsUniverse,
  IPerpsUniverseRaw,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IHyperLiquidErrorLocaleItem,
  IPerpOrderBookTickOptionPersist,
} from '@onekeyhq/shared/types/hyperliquid/types';

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
  hyperliquidOrderBookTickOptions?: Record<
    string,
    IPerpOrderBookTickOptionPersist
  >;
  tradingUniverse?: IPerpsUniverse[] | undefined;
  marginTablesMap?: IMarginTablesMap;
  agentTTL?: number; // in milliseconds
  referralCode?: string;
  tradingviewDisplayPriceScale?: Record<string, number>; // decimal places for price display in tradingview chart
  hyperliquidTermsAccepted?: boolean;
  hyperliquidErrorLocales?: IHyperLiquidErrorLocaleItem[];
}

export class SimpleDbEntityPerp extends SimpleDbEntityBase<ISimpleDbPerpData> {
  entityName = 'perp';

  override enableCache = true;

  @backgroundMethod()
  async getHyperliquidTermsAccepted(): Promise<boolean> {
    const config = await this.getPerpData();
    return config.hyperliquidTermsAccepted ?? false;
  }

  @backgroundMethod()
  async setHyperliquidTermsAccepted(termsAccepted: boolean) {
    await this.setPerpData(
      (prevConfig): ISimpleDbPerpData => ({
        ...prevConfig,
        hyperliquidTermsAccepted: termsAccepted,
      }),
    );
  }

  @backgroundMethod()
  async getPerpData(): Promise<ISimpleDbPerpData> {
    const config = await this.getRawData();
    const result = config || {
      tradingUniverse: [],
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
  async getTradingUniverse(): Promise<{
    universeItems: IPerpsUniverse[];
    marginTablesMap: IMarginTablesMap | undefined;
  }> {
    const config = await this.getPerpData();
    return {
      universeItems: config.tradingUniverse || [],
      marginTablesMap: config.marginTablesMap,
    };
  }

  @backgroundMethod()
  async setTradingUniverse({
    universe,
    marginTablesMap,
  }: {
    universe: IPerpsUniverseRaw[];
    marginTablesMap: IMarginTablesMap;
  }) {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        marginTablesMap,
        tradingUniverse: universe.map((item, index) => {
          return {
            ...item,
            assetId: index,
          };
        }),
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

  @backgroundMethod()
  async getOrderBookTickOptions(): Promise<
    Record<string, IPerpOrderBookTickOptionPersist>
  > {
    const config = await this.getPerpData();
    return config.hyperliquidOrderBookTickOptions ?? {};
  }

  @backgroundMethod()
  async setOrderBookTickOption({
    symbol,
    option,
  }: {
    symbol: string;
    option: IPerpOrderBookTickOptionPersist | null;
  }) {
    await this.setPerpData((prevConfig): ISimpleDbPerpData => {
      const nextOptions = {
        ...(prevConfig?.hyperliquidOrderBookTickOptions ?? {}),
      };
      if (!option) {
        delete nextOptions[symbol];
      } else {
        nextOptions[symbol] = option;
      }

      return {
        ...prevConfig,
        hyperliquidOrderBookTickOptions: nextOptions,
      };
    });
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
        marginTablesMap: prev?.marginTablesMap,
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

  @backgroundMethod()
  async getHyperliquidErrorLocales(): Promise<
    IHyperLiquidErrorLocaleItem[] | undefined
  > {
    const config = await this.getPerpData();
    return config.hyperliquidErrorLocales;
  }
}
