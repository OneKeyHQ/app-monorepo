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
  async isBindInviteCode() {
    const inviteCode =
      await this.backgroundApi.simpleDb.referralCode.getInviteCode();
    return inviteCode !== '';
  }
}

export default ServiceReferralCode;
