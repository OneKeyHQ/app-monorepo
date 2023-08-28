/* eslint-disable @typescript-eslint/require-await  */

import semver from 'semver';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import {
  setEnableIOSDappSearch,
  setShowBookmark,
} from '@onekeyhq/kit/src/store/reducers/discover';
import type { WalletSwitchItem } from '@onekeyhq/kit/src/store/reducers/settings';
import {
  disableExtSwitchTips,
  setEnableETH2Unstake,
  setWalletSwitch,
  toggleDisableExt,
  toggleWalletSwitch,
} from '@onekeyhq/kit/src/store/reducers/settings';
import {
  setLimitOrderMaintain,
  setSwapMaintain,
} from '@onekeyhq/kit/src/store/reducers/swapTransactions';
import extUtils from '@onekeyhq/kit/src/utils/extUtils';
import {
  MonopolizeNetwork,
  getNetworkWithWalletId,
} from '@onekeyhq/kit/src/views/Me/UtilSection/WalletSwitch/config';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ServiceBase from './ServiceBase';

import type ProviderApiPrivate from '../providers/ProviderApiPrivate';

type RemoteSetting = {
  enableAppRatings: boolean;
  swapMaintain: boolean;
  limitOrderMaintain?: boolean;
  enableETH2Unstake: boolean;
  helloVersion: string;
  bookmarkVersion: string;
  iOSSupportSearchVersion?: string;
  disabledRpcBatchHosts: string[];
};

@backgroundClass()
export default class ServiceSetting extends ServiceBase {
  getFiatEndpoint() {
    return getFiatEndpoint();
  }

  @backgroundMethod()
  async updateRemoteSetting() {
    const baseUrl = this.getFiatEndpoint();
    const url = `${baseUrl}/setting/list`;
    const res = await this.client.get(url);
    const data = res.data as RemoteSetting;

    return this.updateRemoteSettingWithData(data);
  }

  @backgroundMethod()
  async updateRemoteSettingWithData(data: RemoteSetting) {
    const { appSelector, dispatch } = this.backgroundApi;
    await simpleDb.setting.setEnableAppRatings(data.enableAppRatings);
    await simpleDb.setting.setSwapMaintain(data.swapMaintain);
    await simpleDb.setting.setRpcBatchFallbackWhitelistHosts(
      data.disabledRpcBatchHosts.map((u) => ({
        type: 'default',
        url: u,
      })),
    );
    const actions = [
      setEnableETH2Unstake(data.enableETH2Unstake),
      setSwapMaintain(data.swapMaintain),
      setLimitOrderMaintain(!!data.limitOrderMaintain),
    ] as any[];
    let v = '';
    if (platformEnv.isNativeIOS || platformEnv.isMas) {
      if (platformEnv.isNativeIOS && data.helloVersion) {
        v = data.helloVersion;
      } else if (platformEnv.isMas && data.bookmarkVersion) {
        v = data.bookmarkVersion;
      }
      if (v && semver.valid(v)) {
        const version = appSelector((s) => s.settings.version);
        if (semver.lte(version, v)) {
          actions.push(setShowBookmark(true));
        }
      }
      const v2 = data.iOSSupportSearchVersion;
      if (v2 && semver.valid(v2)) {
        const version = appSelector((s) => s.settings.version);
        if (semver.lte(version, v2)) {
          actions.push(setEnableIOSDappSearch(true));
        }
      }
    }
    dispatch(...actions);
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
  async setAppReviewsLastOpenedAt(value: number) {
    return simpleDb.setting.setAppReviewsLastOpenedAt(value);
  }

  @backgroundMethod()
  async getAppReviewsLastOpenedAt() {
    return simpleDb.setting.getAppReviewsLastOpenedAt();
  }

  @backgroundMethod()
  async getEnableAppRatings() {
    return simpleDb.setting.getEnableAppRatings();
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

  @backgroundMethod()
  async setWalletSwitchConfig(config: Record<string, WalletSwitchItem>) {
    return this.backgroundApi.dispatch(setWalletSwitch(config));
  }

  @backgroundMethod()
  async toggleWalletSwitchConfig(walletId: string, enable: boolean) {
    const actions = [];

    const networkId = getNetworkWithWalletId(walletId);
    const walletSwitch =
      this.backgroundApi.store.getState().settings.walletSwitchData || {};

    // Monopolize the network's injection
    if (MonopolizeNetwork.includes(networkId)) {
      const relevantIds = Object.keys(walletSwitch).filter(
        (id) => id !== walletId && id.startsWith(networkId),
      );

      let continueOneEnabled = false;

      for (const relevantId of relevantIds) {
        const currentEnabled = walletSwitch[relevantId].enable;
        if (currentEnabled) {
          if (!enable && !continueOneEnabled) {
            // If the operation is closed, you need to leave one wallet open.
            continueOneEnabled = true;
          } else {
            actions.push(
              toggleWalletSwitch({ walletId: relevantId, enable: false }),
            );
          }
        }
      }
    }

    actions.push(toggleWalletSwitch({ walletId, enable }));

    this.backgroundApi.dispatch(...actions);
    const privateProvider = this.backgroundApi.providers
      .$private as ProviderApiPrivate;
    privateProvider.notifyExtSwitchChanged({
      send: this.backgroundApi.sendForProvider('$private'),
    });
  }
}
