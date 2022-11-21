/* eslint-disable @typescript-eslint/require-await  */
import axios from 'axios';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';

import {
  disableExtSwitchTips,
  toggleDisableExt,
} from '../../store/reducers/settings';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';
import ProviderApiPrivate from '../providers/ProviderApiPrivate';
import extUtils from '../../utils/extUtils';

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

  @backgroundMethod()
  async toggleDisableExt() {
    const privateProvider = this.backgroundApi.providers
      .$private as ProviderApiPrivate;
    privateProvider.notifyExtSwitchChanged({
      send: this.backgroundApi.sendForProvider('$private'),
    });
    const disableExt = this.backgroundApi.appSelector(
      (s) => s.settings.disableExt,
    );
    const iconPath = `icon-128${disableExt ? '' : '-disable'}.png`;
    extUtils.handleIconChange(iconPath);
    return this.backgroundApi.dispatch(toggleDisableExt());
  }

  @backgroundMethod()
  async disableExtSwitchTips() {
    return this.backgroundApi.dispatch(disableExtSwitchTips());
  }
}
