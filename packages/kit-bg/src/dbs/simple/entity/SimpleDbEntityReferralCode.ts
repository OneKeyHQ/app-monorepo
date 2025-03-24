import type { IAddressItem } from '@onekeyhq/kit/src/views/AddressBook/type';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IReferralCodeData {
  myReferralCode: string;
  inviteCode: string;
}

export class SimpleDbEntityReferralCode extends SimpleDbEntityBase<IReferralCodeData> {
  entityName = 'ReferralCode';

  override enableCache = false;

  updateCode({ myReferralCode, inviteCode }: IReferralCodeData) {
    return this.setRawData((rawData) => ({
      ...rawData,
      myReferralCode,
      inviteCode,
    }));
  }

  async getReferralCode(): Promise<string> {
    const rawData = await this.getRawData();
    return rawData?.myReferralCode ?? '';
  }

  async getInviteCode(): Promise<string> {
    const rawData = await this.getRawData();
    return rawData?.inviteCode ?? '';
  }
}
