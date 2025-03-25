import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceReferralCode extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async getInviteCode() {
    const inviteCode =
      await this.backgroundApi.simpleDb.referralCode.getInviteCode();
    return inviteCode;
  }

  @backgroundMethod()
  async getMyReferralCode() {
    const myReferralCode =
      await this.backgroundApi.simpleDb.referralCode.getMyReferralCode();
    return myReferralCode;
  }

  @backgroundMethod()
  async isBindInviteCode() {
    const inviteCode =
      await this.backgroundApi.simpleDb.referralCode.getInviteCode();
    return inviteCode !== '';
  }

  @backgroundMethod()
  async bindInviteCode(code: string) {
    await this.backgroundApi.simpleDb.referralCode.updateCode({
      inviteCode: code,
    });
  }

  @backgroundMethod()
  async updateMyReferralCode(code: string) {
    await this.backgroundApi.simpleDb.referralCode.updateCode({
      myReferralCode: code,
    });
  }
}

export default ServiceReferralCode;
