import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IEarnExtraData {
  ethenaKycAddresses?: string[];
  firstOperationFlags?: Record<string, boolean>;
}

export class SimpleDbEntityEarnExtra extends SimpleDbEntityBase<IEarnExtraData> {
  entityName = 'earnExtraData';

  override enableCache = false;

  @backgroundMethod()
  async getEthenaKycAddress() {
    const data = await this.getRawData();
    if (
      Array.isArray(data?.ethenaKycAddresses) &&
      data.ethenaKycAddresses.length > 0
    ) {
      return data.ethenaKycAddresses[0];
    }
    return null;
  }

  @backgroundMethod()
  async setEthenaKycAddresses(addresses: string[]) {
    await this.setRawData((v) => ({
      ...v,
      ethenaKycAddresses: addresses,
    }));
  }

  @backgroundMethod()
  async isFirstOperation(
    networkId: string,
    providerName: string,
    address: string,
    operationType: 'deposit' | 'withdraw',
  ) {
    const data = await this.getRawData();
    const key = `${networkId}--${providerName}--${address}--${operationType}`;
    return !data?.firstOperationFlags?.[key];
  }

  @backgroundMethod()
  async markFirstOperation(
    networkId: string,
    providerName: string,
    address: string,
    operationType: 'deposit' | 'withdraw',
  ) {
    const key = `${networkId}--${providerName}--${address}--${operationType}`;
    await this.setRawData((v) => ({
      ...v,
      firstOperationFlags: {
        ...v?.firstOperationFlags,
        [key]: true,
      },
    }));
  }
}
