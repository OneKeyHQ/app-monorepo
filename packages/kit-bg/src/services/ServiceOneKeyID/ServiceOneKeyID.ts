import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from '../ServiceBase';

class ServiceOneKeyID extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // ============ Login with Access Token ============

  @backgroundMethod()
  async loginWithAccessToken({
    accessToken,
  }: {
    accessToken: string;
  }): Promise<{ success: boolean }> {
    if (!accessToken) {
      return { success: false };
    }

    // Login to Prime service with the access token
    await this.backgroundApi.servicePrime.apiLogin({ accessToken });

    return { success: true };
  }

  // ============ Check Login Status ============

  @backgroundMethod()
  async isLoggedIn(): Promise<boolean> {
    try {
      const result = await this.backgroundApi.servicePrime.isLoggedIn();
      return result;
    } catch {
      return false;
    }
  }

  // ============ Get User Info ============

  @backgroundMethod()
  async getLocalUserInfo() {
    return this.backgroundApi.servicePrime.getLocalUserInfo();
  }
}

export default ServiceOneKeyID;
