import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IMarginTables,
  IPerpsUniverse,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

import type { IPerpBannerConfig } from '../../../services/ServiceWebviewPerp/ServiceWebviewPerp';

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
  marginTables: IMarginTables | undefined;
}

export class SimpleDbEntityPerp extends SimpleDbEntityBase<ISimpleDbPerpData> {
  entityName = 'perp';

  override enableCache = true;

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
  async getPerpData(): Promise<ISimpleDbPerpData> {
    const config = await this.getRawData();
    return (
      config || {
        tradingUniverse: [],
        marginTables: [],
      }
    );
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
        marginTables: prevConfig?.marginTables,
        hyperliquidCurrentToken: token,
      }),
    );
  }
}
