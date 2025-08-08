import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISimpleDbPerpConfig {
  expectBuilderAddress?: string;
  expectMaxBuilderFee?: number;
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
  async setPerpConfig(config: Partial<ISimpleDbPerpConfig>) {
    await this.setRawData(
      (prev): ISimpleDbPerpConfig => ({
        ...prev,
        ...config,
      }),
    );
  }

  @backgroundMethod()
  async getExpectBuilderAddress(): Promise<string | undefined> {
    const config = await this.getPerpConfig();
    return config.expectBuilderAddress;
  }

  @backgroundMethod()
  async getExpectMaxBuilderFee(): Promise<number | undefined> {
    const config = await this.getPerpConfig();
    return config.expectMaxBuilderFee;
  }

  @backgroundMethod()
  async setExpectBuilderAddress(address: string) {
    await this.setPerpConfig({ expectBuilderAddress: address });
  }

  @backgroundMethod()
  async setExpectMaxBuilderFee(fee: number) {
    await this.setPerpConfig({ expectMaxBuilderFee: fee });
  }
}
