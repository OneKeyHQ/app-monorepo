import { isBoolean } from 'lodash';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  decrypt,
  encrypt,
  getBgSensitiveTextEncodeKey,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { WALLET_TYPE_EXTERNAL } from '@onekeyhq/engine/src/types/wallet';
import { ValidationFields } from '@onekeyhq/kit/src/components/Protected';
import { setBackgroudPasswordPrompt } from '@onekeyhq/kit/src/store/reducers/data';
import extUtils from '@onekeyhq/kit/src/utils/extUtils';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { generateUUID } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { isLightningNetworkByNetworkId } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import ServiceBase from './ServiceBase';

interface IPasswordOptions {
  isLocalAuthentication?: boolean;
  withEnableAuthentication?: boolean;
}

interface IPasswordResData {
  password: string;
  options?: IPasswordOptions;
}

interface IPasswordResError {
  errorDetail?: string;
  errorDetailFormatMessageId?: string;
  errorDetailFormatMessageValues?: Record<string, any>;
}

export enum EPasswordResStatus {
  CLOSE_STATUS = 'close',
  ERROR_STATUS = 'error',
  PASS_STATUS = 'pass',
}
export interface IPasswordRes {
  status: EPasswordResStatus;
  data?: IPasswordResData;
  error?: IPasswordResError;
}

@backgroundClass()
export default class ServicePassword extends ServiceBase {
  private data?: string;

  private passwordPromise: Promise<IPasswordRes> | undefined;

  private promiseMap: Record<
    string,
    {
      resolve: (res: IPasswordRes) => void;
    }
  > = {};

  getRandomString() {
    return generateUUID();
  }

  clearData() {
    this.data = undefined;
  }

  setPromiseMap(
    promiseId: string,
    promise: {
      resolve: (res: IPasswordRes) => void;
    },
  ) {
    this.promiseMap[promiseId] = promise;
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

  async checkWalletIsNeedInputPassWord(walletId: string | null) {
    const { appSelector, engine, serviceHardware } = this.backgroundApi;
    const walletDetail =
      appSelector((s) => s.runtime.wallets?.find?.((w) => w.id === walletId)) ??
      null;
    /**
     * Hardware Wallet dont need input password at here, hardware need to input password at device
     *
     * also if it is hardware device, need to connect bluetooth and check connection status
     */
    const isHardware = walletDetail?.type === 'hw';
    const isExternalWallet = walletDetail?.type === WALLET_TYPE_EXTERNAL;
    if (isExternalWallet) {
      return Promise.resolve({ status: EPasswordResStatus.CLOSE_STATUS });
    }
    if (isHardware) {
      const currentWalletDevice = await engine.getHWDeviceByWalletId(
        walletDetail.id,
      );
      if (!currentWalletDevice || !walletDetail?.id) {
        return Promise.resolve({
          status: EPasswordResStatus.ERROR_STATUS,
          error: {
            errorDetailMessageId: 'action__connection_timeout',
          },
        });
      }
      let features: IOneKeyDeviceFeatures | null = null;
      try {
        const featuresCache = await serviceHardware.getFeatursByWalletId(
          walletDetail.id,
        );
        if (featuresCache) {
          features = featuresCache;
          debugLogger.hardwareSDK.debug('use features cache: ', featuresCache);
        } else {
          features = await serviceHardware.getFeatures(currentWalletDevice.mac);
        }
      } catch (e: any) {
        deviceUtils.showErrorToast(e);
        return Promise.resolve({ status: EPasswordResStatus.CLOSE_STATUS });
      }
      if (!features) {
        return Promise.resolve({
          status: EPasswordResStatus.ERROR_STATUS,
          error: {
            errorDetailMessageId: 'modal__device_status_check',
          },
        });
      }
      return Promise.resolve({
        status: EPasswordResStatus.PASS_STATUS,
        data: { password: '', option: { deviceFeatures: features } },
      });
    }
    return Promise.resolve();
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
  }): Promise<IPasswordRes> {
    // check multiple call
    if (
      this.passwordPromise &&
      Promise.resolve(this.passwordPromise) === this.passwordPromise
    ) {
      return this.passwordPromise;
    }

    // check ext ui open
    if (platformEnv.isExtension && !extUtils.checkExtUIOpen()) {
      return Promise.resolve({ status: EPasswordResStatus.ERROR_STATUS });
    }
    // check hw external wallet
    const walletCheckRes = await this.checkWalletIsNeedInputPassWord(walletId);
    if (walletCheckRes) {
      return Promise.resolve(walletCheckRes);
    }

    const { serviceLightningNetwork, appSelector, engine } = this.backgroundApi;
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

    this.passwordPromise = new Promise<IPasswordRes>((resolve) => {
      const promiseId = this.getRandomString();
      this.setPromiseMap(promiseId, { resolve });
      this.backgroundApi.dispatch(
        setBackgroudPasswordPrompt({
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

    return this.passwordPromise;
  }

  @backgroundMethod()
  backgroundPromptPasswordDialogRes(promiseId: string, res: IPasswordRes) {
    const promise = this.promiseMap[promiseId];
    if (promise) {
      promise.resolve(res);
    }
    this.passwordPromise = undefined;
  }
}
