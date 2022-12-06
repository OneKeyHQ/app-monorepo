/* eslint-disable @typescript-eslint/require-await  */
import axios from 'axios';
import semver from 'semver';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';

import { setShowFullLayout } from '../../store/reducers/discover';
import {
  disableExtSwitchTips,
  toggleDisableExt,
} from '../../store/reducers/settings';
import { setSwapMaintain } from '../../store/reducers/swapTransactions';
import extUtils from '../../utils/extUtils';
import { backgroundClass, backgroundMethod } from '../decorators';
import ProviderApiPrivate from '../providers/ProviderApiPrivate';

import ServiceBase from './ServiceBase';

type RemoteSetting = {
  enableAppRatings: boolean;
  swapMaintain: boolean;
  helloVersion: string;
};

@backgroundClass()
export default class ServiceSetting extends ServiceBase {
  client = axios.create({ timeout: 60 * 1000 });

  getFiatEndpoint() {
    return getFiatEndpoint();
  }

  @backgroundMethod()
  async updateRemoteSetting() {
    const { appSelector, dispatch } = this.backgroundApi;
    const baseUrl = this.getFiatEndpoint();
    const url = `${baseUrl}/setting/list`;
    const res = await this.client.get(url);
    const data = res.data as RemoteSetting;
    await simpleDb.setting.setEnableAppRatings(data.enableAppRatings);
    await simpleDb.setting.setSwapMaintain(data.swapMaintain);
    dispatch(setSwapMaintain(data.swapMaintain));
    if (data.helloVersion && semver.valid(data.helloVersion)) {
      const version = appSelector((s) => s.settings.version);
      if (semver.lte(version, data.helloVersion)) {
        dispatch(setShowFullLayout(true));
      }
    }
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
  async checkBrowserActionIcon() {
    const disableExt = this.backgroundApi.appSelector(
      (s) => s.settings.disableExt,
    );
    extUtils.updatBrowserActionIcon(!disableExt);
  }

  @backgroundMethod()
  async toggleDisableExt() {
    this.backgroundApi.dispatch(toggleDisableExt());
    const privateProvider = this.backgroundApi.providers
      .$private as ProviderApiPrivate;
    privateProvider.notifyExtSwitchChanged({
      send: this.backgroundApi.sendForProvider('$private'),
    });
    this.checkBrowserActionIcon();
  }

  @backgroundMethod()
  async disableExtSwitchTips() {
    return this.backgroundApi.dispatch(disableExtSwitchTips());
  }
}
