import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IEarnBannerTheme,
  IEarnPageBannerListItem,
} from '@onekeyhq/shared/types/earn';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IEarnExtraData {
  ethenaKycAddresses?: string[];
  firstOperationFlags?: Record<string, boolean>;
  // OK-59196: one-time earn risk disclaimer. Device-scoped (same as the perp
  // Hyperliquid terms flag) — once accepted, the dialog never shows again.
  riskDisclaimerAccepted?: boolean;
  /**
   * Legacy unscoped banner cache. New writes use pageBannerListByTheme so a
   * cold start can never paint a banner for the opposite color scheme.
   */
  pageBannerList?: IEarnPageBannerListItem[];
  pageBannerListByTheme?: Partial<
    Record<IEarnBannerTheme, IEarnPageBannerListItem[]>
  >;
}

type IEarnPageBannerListCache = {
  list: IEarnPageBannerListItem[];
  isThemeScoped: boolean;
};

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
  async getRiskDisclaimerAccepted(): Promise<boolean> {
    const data = await this.getRawData();
    return data?.riskDisclaimerAccepted ?? false;
  }

  @backgroundMethod()
  async setRiskDisclaimerAccepted(accepted: boolean) {
    await this.setRawData((v) => ({
      ...v,
      riskDisclaimerAccepted: accepted,
    }));
  }

  @backgroundMethod()
  async setEthenaKycAddresses(addresses: string[]) {
    await this.setRawData((v) => ({
      ...v,
      ethenaKycAddresses: addresses,
    }));
  }

  async getPageBannerListCache(
    theme: IEarnBannerTheme,
  ): Promise<IEarnPageBannerListCache> {
    const data = await this.getRawData();
    const themeScopedList = data?.pageBannerListByTheme?.[theme];
    if (themeScopedList) {
      return { list: themeScopedList, isThemeScoped: true };
    }

    // Existing installations may still have the pre-theme-key cache. Retain
    // only entries that explicitly match the active theme.
    return {
      list: (data?.pageBannerList ?? []).filter(
        (banner) => banner.theme === theme,
      ),
      isThemeScoped: false,
    };
  }

  @backgroundMethod()
  async getPageBannerList(
    theme: IEarnBannerTheme,
  ): Promise<IEarnPageBannerListItem[]> {
    return (await this.getPageBannerListCache(theme)).list;
  }

  @backgroundMethod()
  async setPageBannerList({
    theme,
    pageBannerList,
  }: {
    theme: IEarnBannerTheme;
    pageBannerList: IEarnPageBannerListItem[];
  }) {
    await this.setRawData((v) => ({
      ...v,
      pageBannerListByTheme: {
        ...v?.pageBannerListByTheme,
        [theme]: pageBannerList,
      },
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
