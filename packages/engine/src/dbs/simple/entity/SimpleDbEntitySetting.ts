import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type ISimpleDbEntitySettings = {
  appReviewsLastOpenedAt?: number;
  webAuthnCredentialID?: string;
  enableAppRatings?: boolean;
  swapMaintain?: boolean;
  swapWelcomeShown?: boolean;
  swapReceivingIsNotSendingAccountShown?: boolean;
  swapReceivingUnknownShown?: boolean;
};

export class SimpleDbEntitySetting extends SimpleDbEntityBase<ISimpleDbEntitySettings> {
  entityName = 'setting';

  async getAppReviewsLastOpenedAt(): Promise<number> {
    const data = await this.getRawData();
    return data?.appReviewsLastOpenedAt ?? 0;
  }

  async setAppReviewsLastOpenedAt(appReviewsLastOpenedAt: number) {
    const rawData = await this.getRawData();
    return this.setRawData({ ...rawData, appReviewsLastOpenedAt });
  }

  async getWebAuthnCredentialID() {
    const data = await this.getRawData();
    return data?.webAuthnCredentialID;
  }

  async setWebAuthnCredentialID(webAuthnCredentialID: string) {
    const rawData = await this.getRawData();
    return this.setRawData({ ...rawData, webAuthnCredentialID });
  }

  async setEnableAppRatings(enableAppRatings: boolean) {
    const rawData = await this.getRawData();
    return this.setRawData({ ...rawData, enableAppRatings });
  }

  async getEnableAppRatings() {
    const data = await this.getRawData();
    return Boolean(data?.enableAppRatings);
  }

  async setSwapMaintain(swapMaintain: boolean) {
    const rawData = await this.getRawData();
    return this.setRawData({ ...rawData, swapMaintain });
  }

  async getSwapMaintain() {
    const data = await this.getRawData();
    return Boolean(data?.swapMaintain);
  }

  async setSwapWelcomeShown(swapWelcomeShown: boolean) {
    const rawData = await this.getRawData();
    return this.setRawData({ ...rawData, swapWelcomeShown });
  }

  async getSwapWelcomeShown() {
    const data = await this.getRawData();
    return Boolean(data?.swapWelcomeShown);
  }

  async setSwapReceivingIsNotSendingAccountShown(value: boolean) {
    const rawData = await this.getRawData();
    return this.setRawData({
      ...rawData,
      swapReceivingIsNotSendingAccountShown: value,
    });
  }

  async getSwapReceivingIsNotSendingAccountShown() {
    const data = await this.getRawData();
    return Boolean(data?.swapReceivingIsNotSendingAccountShown);
  }

  async setSwapReceivingUnknownShown(value: boolean) {
    const rawData = await this.getRawData();
    return this.setRawData({ ...rawData, swapReceivingUnknownShown: value });
  }

  async getSwapReceivingUnknownShown() {
    const data = await this.getRawData();
    return Boolean(data?.swapReceivingUnknownShown);
  }
}
