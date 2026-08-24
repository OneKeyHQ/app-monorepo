import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IEarnPageBannerListItem } from '@onekeyhq/shared/types/earn';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IEarnExtraData {
  ethenaKycAddresses?: string[];
  firstOperationFlags?: Record<string, boolean>;
  /**
   * Last banner list the Earn home successfully fetched. Persisted so a cold
   * start can paint the banner at its real height instead of occupying 0pt and
   * expanding once the network answers (OK-60299).
   */
  pageBannerList?: IEarnPageBannerListItem[];
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
  async getPageBannerList(): Promise<IEarnPageBannerListItem[]> {
    const data = await this.getRawData();
    return data?.pageBannerList ?? [];
  }

  @backgroundMethod()
  async setPageBannerList(pageBannerList: IEarnPageBannerListItem[]) {
    await this.setRawData((v) => ({
      ...v,
      pageBannerList,
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
