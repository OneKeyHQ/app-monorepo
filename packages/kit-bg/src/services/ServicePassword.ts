import { isBoolean } from 'lodash';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  decrypt,
  encrypt,
  getBgSensitiveTextEncodeKey,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { WALLET_TYPE_EXTERNAL } from '@onekeyhq/engine/src/types/wallet';
import { ValidationFields } from '@onekeyhq/kit/src/components/Protected';
import { setBackgroundPasswordPrompt } from '@onekeyhq/kit/src/store/reducers/data';
import extUtils from '@onekeyhq/kit/src/utils/extUtils';
import { generateUUID } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { isLightningNetworkByNetworkId } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import ServiceBase from './ServiceBase';

interface IPasswordOptions {
  isLocalAuthentication?: boolean;
  withEnableAuthentication?: boolean;
  deviceFeatures?: IOneKeyDeviceFeatures;
}

interface IPasswordResData {
  password: string;
  options?: IPasswordOptions;
}
export enum EPasswordResStatus {
  CLOSE_STATUS = 'close',
  PASS_STATUS = 'pass',
}
export interface IPasswordRes {
  status: EPasswordResStatus;
  data: IPasswordResData;
}

@backgroundClass()
export default class ServicePassword extends ServiceBase {
  private data?: string;

  getRandomString() {
    return generateUUID();
  }

  clearData() {
    this.data = undefined;
  }

  async setData(password: string): Promise<string> {
    const key = this.getRandomString();
    const data = encrypt(key, Buffer.from(password, 'utf-8'), {
      skipSafeCheck: true,
    }).toString('hex');
    await simpleDb.pwkey.setRawData({ key });
    this.data = data;
    return data;
  }

  @backgroundMethod()
  encryptByInstanceId(
    input: string,
    {
      inputEncoding = 'utf-8',
      outputEncoding = 'hex',
    }: {
      inputEncoding?: BufferEncoding;
      outputEncoding?: BufferEncoding;
    } = {},
  ): Promise<string> {
    const { appSelector } = this.backgroundApi;
    const { instanceId } = appSelector((s) => s.settings);
    const output = encrypt(instanceId, Buffer.from(input, inputEncoding), {
      skipSafeCheck: true,
    }).toString(outputEncoding);
    return Promise.resolve(output);
  }

  @backgroundMethod()
  decryptByInstanceId(
    input: string,
    {
      inputEncoding = 'hex',
      outputEncoding = 'utf-8',
    }: {
      inputEncoding?: BufferEncoding;
      outputEncoding?: BufferEncoding;
    } = {},
  ): Promise<string> {
    const { appSelector } = this.backgroundApi;
    const { instanceId } = appSelector((s) => s.settings);
    const output = decrypt(instanceId, Buffer.from(input, inputEncoding), {
      skipSafeCheck: true,
    }).toString(outputEncoding);
    return Promise.resolve(output);
  }

  async getData(ttl?: number): Promise<string | undefined> {
    if (!this.data) {
      return undefined;
    }
    const keyData = await simpleDb.pwkey.getRawData();
    const { updatedAt } = simpleDb.pwkey;
    if (!keyData || !keyData.key) {
      return undefined;
    }
    let data: string | undefined;
    try {
      data = decrypt(keyData.key, Buffer.from(this.data, 'hex'), {
        skipSafeCheck: true,
      }).toString('utf-8');
    } catch {
      return undefined;
    }
    if (!ttl || Number.isNaN(ttl)) {
      return data;
    }
    const now = Date.now();
    return now - updatedAt <= ttl ? data : undefined;
  }

  @backgroundMethod()
  async verifyPassword(password: string): Promise<boolean> {
    const { engine } = this.backgroundApi;
    return engine.verifyMasterPassword(password);
  }

  @backgroundMethod()
  async savePassword(password: string): Promise<void> {
    const isOk = await this.verifyPassword(password);
    if (isOk) {
      await this.setData(password);
      appEventBus.emit(AppEventBusNames.BackupRequired);
    }
  }

  @backgroundMethod()
  async getPassword() {
    const { appSelector } = this.backgroundApi;
    const enableAppLock = appSelector((s) => s.settings.enableAppLock);
    const ttl = !enableAppLock ? 240 * 60 * 1000 : undefined;
    return this.getPasswordWithTTL(ttl);
  }

  async getPasswordWithTTL(ttl?: number): Promise<string | undefined> {
    const data = await this.getData(ttl);
    if (!data) {
      return undefined;
    }
    const isOk = await this.verifyPassword(data);
    return isOk ? data : undefined;
  }

  @backgroundMethod()
  async getBgSensitiveTextEncodeKey(): Promise<string> {
    return Promise.resolve(getBgSensitiveTextEncodeKey());
  }

  @backgroundMethod()
  async backgroundPromptPasswordDialog({
    walletId,
    field,
    networkId,
    skipSavePassword,
    hideTitle,
    isAutoHeight,
    title,
    subTitle,
    placeCenter,
  }: {
    walletId: string | null;
    field?: ValidationFields;
    skipSavePassword?: boolean;
    hideTitle?: boolean;
    isAutoHeight?: boolean;
    placeCenter?: boolean;
    title?: string;
    subTitle?: string;
    networkId?: string;
  }) {
    const {
      serviceLightningNetwork,
      appSelector,
      serviceApp,
      engine,
      servicePromise,
    } = this.backgroundApi;

    setTimeout(() => {
      serviceApp.checkUpdateStatus();
    }, 1000);

    // check ext ui open
    if (platformEnv.isExtension && !extUtils.checkExtUIOpen()) {
      return Promise.reject(
        new OneKeyInternalError({ key: 'msg__engine__internal_error' }),
      );
    }

    const walletDetail =
      appSelector((s) => s.runtime.wallets?.find?.((w) => w.id === walletId)) ??
      null;

    const isExternalWallet = walletDetail?.type === WALLET_TYPE_EXTERNAL;
    if (isExternalWallet) {
      return Promise.resolve({
        status: EPasswordResStatus.CLOSE_STATUS,
        data: { password: '' },
      });
    }

    // lightningNetwork check
    const accountId = appSelector((s) => s.general.activeAccountId) ?? '';
    if (networkId && isLightningNetworkByNetworkId(networkId)) {
      const lightningNetworkNeedPassword =
        await serviceLightningNetwork.checkAuth({
          networkId,
          accountId,
        });
      if (
        isBoolean(lightningNetworkNeedPassword) &&
        !lightningNetworkNeedPassword
      ) {
        return Promise.resolve({
          status: EPasswordResStatus.PASS_STATUS,
          data: { password: '' },
        });
      }
    }

    // check network validationRequired
    if (networkId) {
      const isPasswordLoadedInVault = appSelector(
        (s) => s.data.isPasswordLoadedInVault,
      );
      let network = appSelector((s) =>
        s.runtime.networks?.find((n) => n.id === networkId),
      );
      if (!network) {
        network = await engine.getNetwork(networkId);
      }
      if (!network?.settings.validationRequired || isPasswordLoadedInVault) {
        return Promise.resolve({
          status: EPasswordResStatus.PASS_STATUS,
          data: { password: '' },
        });
      }
    }

    // check field & cachePassword
    const validationSetting = appSelector((s) => s.settings.validationSetting);
    const fieldValidationSetting = field ? !!validationSetting?.[field] : false;
    const fieldTypeValidation = field && field === ValidationFields.Secret;
    if (!fieldTypeValidation && !fieldValidationSetting) {
      // can use cachePassword
      const cachePassword = await this.getPassword();
      if (cachePassword) {
        return Promise.resolve({
          status: EPasswordResStatus.PASS_STATUS,
          data: { password: cachePassword },
        });
      }
    }

    // password input
    return new Promise((resolve, reject) => {
      const promiseId = servicePromise.createCallback({ resolve, reject });
      this.backgroundApi.dispatch(
        setBackgroundPasswordPrompt({
          promiseId,
          props: {
            skipSavePassword,
            hideTitle,
            isAutoHeight,
            title,
            subTitle,
            placeCenter,
          },
        }),
      );
    });
  }
}
