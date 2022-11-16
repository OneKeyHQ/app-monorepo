/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { setEnableWebAuthn } from '../../store/reducers/settings';
import { getCredential, registerCredential } from '../../utils/webauthn';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceSetting extends ServiceBase {
  @backgroundMethod()
  async getInstanceId() {
    const { appSelector } = this.backgroundApi;
    return appSelector((s) => s.settings.instanceId);
  }

  @backgroundMethod()
  async enableWebAuthn() {
    const { dispatch } = this.backgroundApi;
    const cred = await getCredential();
    if (!cred) {
      const instanceId = await this.getInstanceId();
      const credRegister = await registerCredential({
        userName: instanceId,
        userDisplayName: instanceId,
      });
      dispatch(setEnableWebAuthn(!credRegister));
      return !!cred;
    }
    dispatch(setEnableWebAuthn(true));
    return true;
  }

  @backgroundMethod()
  async disableWebAuthn() {
    const { dispatch } = this.backgroundApi;
    dispatch(setEnableWebAuthn(false));
    return true;
  }

  @backgroundMethod()
  async webAuthenticate(): Promise<boolean> {
    const cred = await getCredential();
    return !!cred;
  }
}
