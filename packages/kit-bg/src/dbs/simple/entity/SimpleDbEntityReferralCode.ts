import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IReferralCodeData {
  myReferralCode: string;
  inviteCode: string;
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
    });
  }
}
