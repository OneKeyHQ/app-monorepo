import { Buffer } from 'buffer';

import {
  EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from 'react-native';

import { Callback, CallbackError, CardInfo } from './types';

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

  encodeMnemonic(
    version: string,
    language: string,
    mnemonic: string[],
  ): string {
    const enMnemonic = mnemonic.reduce((pre, cur) => `${pre} ${cur}`);
    return Buffer.from(enMnemonic, 'utf8').toString('hex');
    // const meta = LiteFlag.TAG + LiteFlag.VERSION + LiteFlag.LANGUAGE;
    // const enMnemonic = ''; // mnemonic to index
    // return enMnemonic + meta;
  }

  decodeMnemonic(payload: string): string {
    const meta = payload.slice(-8);
    const regexp = new RegExp('^ffff[a-f0-9]{4}$');
    if (regexp.test(meta)) {
      // const version = meta.slice(4, 6);
      const enMnemonic = payload.slice(0, -8);
      // deMnemonic = ''; // mnemonic to index
      return enMnemonic;
    }
    return Buffer.from(payload, 'hex').toString();
  }

  addConnectListener(listener: (event: NfcConnectUiState) => void) {
    return this.UiEventEmitter?.addListener('nfc_ui_event', listener);
  }

  removeConnectListener(listener: EmitterSubscription) {
    return this.UiEventEmitter?.removeSubscription(listener);
  }

  addAccordListener() {
    if (Platform.OS !== 'android') return;
    const eventEmitter = new NativeEventEmitter(OKLiteManager);
    return eventEmitter.addListener('nfc_active_connection', (event: any) => {
      console.log(
        'nfc_active_connection',
        'A new NFC device is actively connected. ',
        event,
      );
    });
  }

  getCardName(result: Callback<string>) {
    OKLiteManager.getCardName(result);
  }

  getLiteInfo(result: Callback<CardInfo>) {
    OKLiteManager.getLiteInfo(result);
  }

  setMnemonic(
    mnemonic: string | string[],
    pwd: string,
    result: Callback<boolean>,
    overwrite = false,
  ) {
    let mnemonicArray: string[];
    if (typeof mnemonic === 'string') {
      mnemonicArray = mnemonic.trim().split('\\s+');
    } else {
      mnemonicArray = mnemonic;
    }

    const payload = this.encodeMnemonic(
      LiteFlag.VERSION,
      LiteFlag.LANGUAGE,
      mnemonicArray,
    );
    OKLiteManager.setMnemonic(payload, pwd, overwrite, result);
  }

  getMnemonicWithPin(pwd: string, result: Callback<string>) {
    OKLiteManager.getMnemonicWithPin(
      pwd,
      (
        error: CallbackError | null,
        data: string | null,
        state: CardInfo | null,
      ) => {
        result(error, data ? this.decodeMnemonic(data) : null, state);
      },
    );
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
