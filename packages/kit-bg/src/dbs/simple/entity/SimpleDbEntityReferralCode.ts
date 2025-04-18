import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IReferralCodeData {
  myReferralCode: string;
  inviteCode: string;
  postConfig?: IInvitePostConfig;
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

  async getInviteCode(): Promise<string> {
    const rawData = await this.getRawData();
    return rawData?.inviteCode ?? '';
  }

  async reset() {
    return this.setRawData({
      myReferralCode: '',
      inviteCode: '',
      postConfig: undefined,
    });
  }
}
