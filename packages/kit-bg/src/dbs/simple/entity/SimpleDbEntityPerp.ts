import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IHyperliquidCustomSettings = {
  hideNavBar?: boolean;
  hideNavBarConnectButton?: boolean;
  hideNotOneKeyWalletConnectButton?: boolean;
};
export interface ISimpleDbPerpConfig {
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
}

export class SimpleDbEntityPerp extends SimpleDbEntityBase<ISimpleDbPerpConfig> {
  entityName = 'perp';

  override enableCache = true;

  @backgroundMethod()
  async getPerpConfig(): Promise<ISimpleDbPerpConfig> {
    const config = await this.getRawData();
    return config || {};
  }

  @backgroundMethod()
  async setPerpConfig(
    setFn: (
      prevConfig: ISimpleDbPerpConfig | null | undefined,
    ) => ISimpleDbPerpConfig,
  ) {
    await this.setRawData(setFn);
  }

  @backgroundMethod()
  async getExpectBuilderAddress(): Promise<string | undefined> {
    const config = await this.getPerpConfig();
    return config.hyperliquidBuilderAddress;
  }

  @backgroundMethod()
  async getExpectMaxBuilderFee(): Promise<number | undefined> {
    const config = await this.getPerpConfig();
    return config.hyperliquidMaxBuilderFee;
  }

  @backgroundMethod()
  async getCurrentToken(): Promise<string> {
    const config = await this.getPerpConfig();
    return config.hyperliquidCurrentToken || 'ETH';
  }

  @backgroundMethod()
  async setCurrentToken(token: string) {
    await this.setPerpConfig((prevConfig) => ({
      ...prevConfig,
      hyperliquidCurrentToken: token,
    }));
  }
}
