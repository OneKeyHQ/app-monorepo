import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IWalletReferralCode {
  walletId: string;
  address: string;
  networkId: string;
  pubkey: string;
  isBound: boolean;
  createdAt?: number;
}

export interface IReferralCodeData {
  myReferralCode: string;
  postConfig?: IInvitePostConfig;
  walletReferralCode?: Record<string, IWalletReferralCode>;
}

export class SimpleDbEntityReferralCode extends SimpleDbEntityBase<IReferralCodeData> {
  entityName = 'ReferralCode';

  override enableCache = false;

  updateCode(params: Partial<IReferralCodeData>) {
    return this.setRawData(
      (rawData) =>
        ({
          ...rawData,
          ...params,
        } as IReferralCodeData),
    );
  }

  updatePostConfig(params: IInvitePostConfig) {
    return this.setRawData(
      (rawData) =>
        ({
          ...rawData,
          postConfig: params,
        } as IReferralCodeData),
    );
  }

  async getPostConfig(): Promise<IInvitePostConfig | undefined> {
    const rawData = await this.getRawData();
    return rawData?.postConfig;
  }

  async getMyReferralCode(): Promise<string> {
    const rawData = await this.getRawData();
    return rawData?.myReferralCode ?? '';
  }

  async getWalletReferralCode({
    walletId,
  }: {
    walletId: string;
  }): Promise<IWalletReferralCode | undefined> {
    const rawData = await this.getRawData();
    return rawData?.walletReferralCode?.[walletId];
  }

  async setWalletReferralCode({
    walletId,
    referralCodeInfo,
  }: {
    walletId: string;
    referralCodeInfo: IWalletReferralCode;
  }) {
    return this.setRawData(
      (rawData) =>
        ({
          ...rawData,
          walletReferralCode: {
            ...rawData?.walletReferralCode,
            [walletId]: {
              walletId: referralCodeInfo.walletId,
              address: referralCodeInfo.address,
              networkId: referralCodeInfo.networkId,
              pubkey: referralCodeInfo.pubkey,
              isBound: referralCodeInfo.isBound,
              createdAt: Date.now(),
            },
          },
        } as IReferralCodeData),
    );
  }

  async resetPostConfig() {
    return this.setRawData(
      (rawData) =>
        ({
          ...rawData,
          postConfig: undefined,
        } as IReferralCodeData),
    );
  }

  async reset() {
    return this.setRawData({
      myReferralCode: '',
      postConfig: undefined,
      walletReferralCode: {},
    });
  }
}
