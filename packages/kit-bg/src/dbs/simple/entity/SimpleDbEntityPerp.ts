import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  HYPERLIQUID_AGENT_TTL_DEFAULT,
  HYPERLIQUID_REFERRAL_CODE,
} from '@onekeyhq/shared/src/consts/perp';
import type { ITokenSearchAliases } from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IMarginTableMap as IMarginTablesMap,
  IPerpsUniverse,
  ISpotToken,
  ISpotUniverse,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IHyperLiquidErrorLocaleItem,
  IPerpOrderBookTickOptionPersist,
} from '@onekeyhq/shared/types/hyperliquid/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

import type { IPerpDynamicTab } from '../../../services/ServiceWebviewPerp';

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
  tradingUniverse?: IPerpsUniverse[] | undefined; // legacy single-dex
  marginTablesMap?: IMarginTablesMap; // legacy single-dex
  tradingUniverses?: IPerpsUniverse[][]; // multi-dex
  marginTablesMapList?: Array<IMarginTablesMap | undefined>;
  agentTTL?: number; // in milliseconds
  referralCode?: string;
  configVersion?: string;
  tradingviewDisplayPriceScale?: Record<string, number>; // decimal places for price display in tradingview chart
  hyperliquidTermsAccepted?: boolean;
  perpOrderOpenFlags?: Record<string, boolean>; // user address -> whether orderOpen has succeeded
  hyperliquidErrorLocales?: IHyperLiquidErrorLocaleItem[];
  dexAbstractionEnabledUsers?: Record<string, boolean>; // user address -> HIP-3 DEX abstraction enabled status
  abstractionModeUsers?: Record<string, string>; // user address -> EHyperLiquidAbstractionMode
  referralBannerSnoozedUntil?: Record<string, number>; // user address -> timestamp until which the banner is snoozed
  referralBannerCache?: Record<
    string,
    {
      shouldShow: boolean;
      reason: string;
      cachedAt: number;
    }
  >; // user address -> cached eligibility result
  perpsSharePromptShown?: boolean; // whether the once-per-app Perps share prompt has been shown
  tokenSearchAliases?: ITokenSearchAliases; // token search aliases from server
  tokenSelectorTabs?: IPerpDynamicTab[]; // dynamic token selector tabs from server
  spotTokens?: ISpotToken[]; // all spot tokens metadata
  spotUniverses?: ISpotUniverse[]; // spot trading pairs with resolved names
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
  async isFirstPerpOrderOpen(userAddress: string): Promise<boolean> {
    const key = userAddress.toLowerCase();
    if (!key) {
      return true;
    }
    const config = await this.getPerpData();
    return !config.perpOrderOpenFlags?.[key];
  }

  @backgroundMethod()
  async markPerpOrderOpen(userAddress: string) {
    const key = userAddress.toLowerCase();
    if (!key) {
      return;
    }
    await this.setPerpData(
      (prevConfig): ISimpleDbPerpData => ({
        ...prevConfig,
        perpOrderOpenFlags: {
          ...prevConfig?.perpOrderOpenFlags,
          [key]: true,
        },
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
    universesByDex: IPerpsUniverse[][];
    marginTablesMapByDex: Array<IMarginTablesMap | undefined>;
  }> {
    const config = await this.getPerpData();
    const tradingUniverses = config.tradingUniverses;
    let universesByDex: IPerpsUniverse[][] = [];
    if (Array.isArray(tradingUniverses) && tradingUniverses.length > 0) {
      universesByDex = !Array.isArray(tradingUniverses[0] as unknown)
        ? [tradingUniverses as unknown as IPerpsUniverse[]]
        : tradingUniverses;
    } else if (
      Array.isArray(config.tradingUniverse) &&
      config.tradingUniverse.length > 0
    ) {
      universesByDex = [config.tradingUniverse];
    }

    let marginTablesMapByDex: Array<IMarginTablesMap | undefined> = [];
    if (
      Array.isArray(config.marginTablesMapList) &&
      config.marginTablesMapList.length > 0
    ) {
      marginTablesMapByDex = config.marginTablesMapList;
    } else if (config.marginTablesMap) {
      marginTablesMapByDex = [config.marginTablesMap];
    }

    return {
      universesByDex,
      marginTablesMapByDex,
    };
  }

  @backgroundMethod()
  async setTradingUniverse({
    universes,
    marginTablesMapList,
  }: {
    universes: IPerpsUniverse[][];
    marginTablesMapList: Array<IMarginTablesMap | undefined>;
  }) {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        marginTablesMapList,
        marginTablesMap: marginTablesMapList?.[0],
        tradingUniverses: universes,
        tradingUniverse: universes?.[0],
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
          ...prevConfig?.hyperliquidCustomSettings,
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
        ...prevConfig?.hyperliquidOrderBookTickOptions,
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
          ...prev?.tradingviewDisplayPriceScale,
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

  @backgroundMethod()
  async isDexAbstractionEnabled(userAddress: string): Promise<boolean> {
    const config = await this.getPerpData();
    return (
      config.dexAbstractionEnabledUsers?.[userAddress.toLowerCase()] ?? false
    );
  }

  @backgroundMethod()
  async setDexAbstractionEnabled(userAddress: string, enabled: boolean) {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        dexAbstractionEnabledUsers: {
          ...prev?.dexAbstractionEnabledUsers,
          [userAddress.toLowerCase()]: enabled,
        },
      }),
    );
  }

  @backgroundMethod()
  async getUserAbstractionMode(
    userAddress: string,
  ): Promise<string | undefined> {
    const config = await this.getPerpData();
    const addr = userAddress.toLowerCase();
    // New field takes priority
    const mode = config.abstractionModeUsers?.[addr];
    if (mode) return mode;
    // Runtime migration: legacy boolean → dexAbstraction mode
    if (config.dexAbstractionEnabledUsers?.[addr] === true) {
      return 'dexAbstraction';
    }
    return undefined;
  }

  @backgroundMethod()
  async setUserAbstractionMode(userAddress: string, mode: string) {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        abstractionModeUsers: {
          ...prev?.abstractionModeUsers,
          [userAddress.toLowerCase()]: mode,
        },
        // Dual-write legacy field only for dexAbstraction; leave untouched for other modes
        ...(mode === 'dexAbstraction'
          ? {
              dexAbstractionEnabledUsers: {
                ...prev?.dexAbstractionEnabledUsers,
                [userAddress.toLowerCase()]: true,
              },
            }
          : {}),
      }),
    );
  }

  @backgroundMethod()
  async getReferralBannerSnoozedUntil(userAddress: string): Promise<number> {
    const config = await this.getPerpData();
    return config.referralBannerSnoozedUntil?.[userAddress.toLowerCase()] ?? 0;
  }

  @backgroundMethod()
  async setReferralBannerSnoozedUntil(
    userAddress: string,
    snoozedUntil: number,
  ): Promise<void> {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        referralBannerSnoozedUntil: {
          ...prev?.referralBannerSnoozedUntil,
          [userAddress.toLowerCase()]: snoozedUntil,
        },
      }),
    );
  }

  @backgroundMethod()
  async getReferralBannerCache(
    userAddress: string,
  ): Promise<{ shouldShow: boolean; reason: string; cachedAt: number } | null> {
    const config = await this.getPerpData();
    return config.referralBannerCache?.[userAddress.toLowerCase()] ?? null;
  }

  @backgroundMethod()
  async setReferralBannerCache(
    userAddress: string,
    cache: { shouldShow: boolean; reason: string; cachedAt: number },
  ): Promise<void> {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        referralBannerCache: {
          ...prev?.referralBannerCache,
          [userAddress.toLowerCase()]: cache,
        },
      }),
    );
  }

  @backgroundMethod()
  async getPerpsSharePromptShown(): Promise<boolean> {
    const config = await this.getPerpData();
    return config.perpsSharePromptShown ?? false;
  }

  @backgroundMethod()
  async setPerpsSharePromptShown(shown: boolean): Promise<void> {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        perpsSharePromptShown: shown,
      }),
    );
  }

  @backgroundMethod()
  async getSpotMeta(): Promise<{
    tokens: ISpotToken[];
    universes: ISpotUniverse[];
  }> {
    const config = await this.getPerpData();
    return {
      tokens: config.spotTokens || [],
      universes: config.spotUniverses || [],
    };
  }

  @backgroundMethod()
  async setSpotMeta({
    tokens,
    universes,
  }: {
    tokens: ISpotToken[];
    universes: ISpotUniverse[];
  }) {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        spotTokens: tokens,
        spotUniverses: universes,
      }),
    );
  }
}
