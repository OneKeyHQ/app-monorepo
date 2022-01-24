import { Buffer } from 'buffer';

import { NativeModules, Platform } from 'react-native';

import { Callback, CallbackError, CardInfo } from './types';

const { OKLiteManager } = NativeModules;

export const LiteFlag = {
  VERSION: '01',
  LANGUAGE: '00', // english
  TAG: 'ffff',
};

class OnekeyLite {
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

    OKLiteManager.setMnemonic(payload, pwd, result);
  }

  getMnemonicWithPin(pwd: string, result: Callback<string>) {
    OKLiteManager.getMnemonicWithPin(
      pwd,
      (
        error: CallbackError | null,
        data: string | null,
        state: CardInfo | null,
      ) => {
        if (data) {
          result(error, this.decodeMnemonic(data), state);
        } else {
          result(error, data, state);
        }
      },
    );
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
