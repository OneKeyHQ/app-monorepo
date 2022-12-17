import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { CardErrors } from './types';

import type { Callback, CallbackError, CardInfo } from './types';

const { OKLiteManager } = NativeModules;

export const LiteFlag = {
  VERSION: '01',
  LANGUAGE: '00', // english
  TAG: 'ffff',
};

export type NfcConnectUiState = {
  code: number;
  message: string;
};

class OnekeyLite {
  UiEventEmitter: NativeEventEmitter | null = null;

  constructor() {
    if (Platform.OS !== 'android') return;
    this.UiEventEmitter = new NativeEventEmitter(OKLiteManager);
  }

  async encodeMnemonic(
    version: string,
    language: string,
    mnemonic: string,
  ): Promise<string> {
    const meta = LiteFlag.TAG + version + language;
    const enMnemonic = await backgroundApiProxy.engine.mnemonicToEntropy(
      mnemonic.trim(),
    ); // mnemonic to index
    return enMnemonic + meta;
  }

  async decodeMnemonic(payload: string) {
    try {
      if (payload.length <= 8)
        return Buffer.from(payload, 'hex').toString().trim();

      const meta = payload.slice(-8);

      const regexp = /^ffff[a-f0-9]{4}$/;
      if (regexp.test(meta)) {
        const version = parseInt(meta.slice(4, 6), 10);
        const enMnemonic = payload.slice(0, -8);

        if (version === 1) {
          const deMnemonic = await backgroundApiProxy.engine.entropyToMnemonic(
            enMnemonic,
          ); // mnemonic to index

          return deMnemonic.trim();
        }

        if (version === 2) {
          const deMnemonic =
            await backgroundApiProxy.engine.entropyToMnemonicV2(enMnemonic); // mnemonic to index

          return deMnemonic.trim();
        }

        // 当前版本不支持
        return '';
      }

      // 兼容 V0 旧版本
      return Buffer.from(payload, 'hex').toString().trim();
    } catch (error) {
      // 数据解析报错
      return '';
    }
  }

  addConnectListener(listener: (event: NfcConnectUiState) => void) {
    this.removeConnectListeners();
    return this.UiEventEmitter?.addListener('nfc_ui_event', listener);
  }

  removeConnectListeners() {
    return this.UiEventEmitter?.removeAllListeners('nfc_ui_event');
  }

  addAccordListener() {
    if (Platform.OS !== 'android') return;
    const eventEmitter = new NativeEventEmitter(OKLiteManager);
    return eventEmitter.addListener('nfc_active_connection', () => {});
  }

  getCardName(result: Callback<string>) {
    OKLiteManager.getCardName(result);
  }

  getLiteInfo(result: Callback<CardInfo>) {
    OKLiteManager.getLiteInfo(result);
  }

  checkNFCPermission(result: Callback<boolean>) {
    OKLiteManager.checkNFCPermission(result);
  }

  setMnemonic(
    mnemonic: string,
    pwd: string,
    result: Callback<boolean>,
    overwrite = false,
  ) {
    this.encodeMnemonic(LiteFlag.VERSION, LiteFlag.LANGUAGE, mnemonic).then(
      (payload) => OKLiteManager.setMnemonic(payload, pwd, overwrite, result),
    );
  }

  getMnemonicWithPin(pwd: string, result: Callback<string>) {
    try {
      OKLiteManager.getMnemonicWithPin(
        pwd,
        async (
          error: CallbackError | null,
          data: string | null,
          state: CardInfo | null,
        ) => {
          result(error, data ? await this.decodeMnemonic(data) : null, state);
        },
      );
    } catch (error) {
      result({ code: CardErrors.ExecFailure, message: null }, null, null);
    }
  }

  changePin(oldPin: string, newPin: string, result: Callback<boolean>) {
    OKLiteManager.changePin(oldPin, newPin, result);
  }

  reset(result: Callback<boolean>) {
    OKLiteManager.reset(result);
  }

  cancel() {
    if (Platform.OS === 'android') OKLiteManager.cancel();
  }

  intoSetting() {
    if (Platform.OS === 'android') OKLiteManager.intoSetting();
  }
}

const onekeyLite = new OnekeyLite();
export default onekeyLite;
