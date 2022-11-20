/* eslint-disable @typescript-eslint/require-await  */
import axios from 'axios';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';

import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

type RemoteSetting = {
  enableAppRatings: boolean;
  swapMaintain: boolean;
};

@backgroundClass()
export default class ServiceSetting extends ServiceBase {
  client = axios.create({ timeout: 60 * 1000 });

  getFiatEndpoint() {
    return getFiatEndpoint();
  }

  @backgroundMethod()
  async updateRemoteSetting() {
    const baseUrl = this.getFiatEndpoint();
    const url = `${baseUrl}/setting/list`;
    const res = await this.client.get(url);
    const data = res.data as RemoteSetting;
    await simpleDb.setting.setEnableAppRatings(data.enableAppRatings);
    await simpleDb.setting.setSwapMaintain(data.swapMaintain);
  }

  @backgroundMethod()
  async getInstanceId() {
    const { appSelector } = this.backgroundApi;
    return appSelector((s) => s.settings.instanceId);
  }

  @backgroundMethod()
  async getWebAuthnCredentialID() {
    return simpleDb.setting.getWebAuthnCredentialID();
  }

  @backgroundMethod()
  async setWebAuthnCredentialID(webAuthnCredentialID: string) {
    return simpleDb.setting.setWebAuthnCredentialID(webAuthnCredentialID);
  }
}
