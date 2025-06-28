import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IEarnExtraData {
  ethenaKycAddress?: string;
}

export class SimpleDbEntityEarnExtra extends SimpleDbEntityBase<IEarnExtraData> {
  entityName = 'earnExtraData';

  override enableCache = false;

  @backgroundMethod()
  async getEthenaKycAddress() {
    const data = await this.getRawData();
    return data?.ethenaKycAddress ?? '';
  }

  @backgroundMethod()
  async setEthenaKycAddress(address: string) {
    await this.setRawData((v) => ({
      ...v,
      ethenaKycAddress: address,
    }));
  }
}
