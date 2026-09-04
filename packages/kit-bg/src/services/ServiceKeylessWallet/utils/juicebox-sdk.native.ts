/* eslint-disable max-classes-per-file */
import {
  type Authentication,
  type Configuration as NativeConfiguration,
  type PinHashingMode,
  type Realm,
} from '@phantom/react-native-juicebox-sdk';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

type INativeSDK =
  (typeof import('@phantom/react-native-juicebox-sdk'))['default'];

const nativeSDK: INativeSDK | undefined = platformEnv.isNativeIOSMacCatalyst
  ? undefined
  : (require('@phantom/react-native-juicebox-sdk') as { default: INativeSDK })
      .default;

function getNativeSDK(): INativeSDK {
  if (!nativeSDK) {
    throw new OneKeyLocalError(
      'Keyless wallets are unavailable on Mac Catalyst',
    );
  }
  return nativeSDK;
}

export class Configuration implements NativeConfiguration {
  realms: Realm[];

  register_threshold: number;

  recover_threshold: number;

  pin_hashing_mode: PinHashingMode;

  constructor(config: NativeConfiguration) {
    this.realms = config.realms;
    this.register_threshold = config.register_threshold;
    this.recover_threshold = config.recover_threshold;
    this.pin_hashing_mode = config.pin_hashing_mode;
  }
}

export class Client {
  config: Configuration;

  constructor(config: Configuration, _ignored?: any[]) {
    this.config = config;
  }

  async register(
    pin: Uint8Array,
    secret: Uint8Array,
    userInfo: Uint8Array,
    guesses: number,
  ): Promise<void> {
    const auth = await this.getAuthentication();
    await getNativeSDK().register(
      this.config,
      auth,
      pin,
      secret,
      userInfo,
      guesses,
    );
  }

  async recover(pin: Uint8Array, userInfo: Uint8Array): Promise<Uint8Array> {
    const auth = await this.getAuthentication();
    return getNativeSDK().recover(this.config, auth, pin, userInfo);
  }

  private async getAuthentication(): Promise<Authentication> {
    const auth: Authentication = {};

    // Get callback from global
    // @ts-ignore
    // eslint-disable-next-line
    const getAuthToken = globalThis.JuiceboxGetAuthToken as (
      realmId: Uint8Array,
    ) => Promise<string>;
    if (!getAuthToken) {
      throw new OneKeyLocalError('JuiceboxGetAuthToken not set');
    }

    for (const realm of this.config.realms) {
      // Convert hex id to bytes for callback
      const realmIdBytes = bufferUtils.hexToBytes(realm.id);
      const token = await getAuthToken(realmIdBytes);
      auth[realm.id] = token;
    }
    return auth;
  }
}
