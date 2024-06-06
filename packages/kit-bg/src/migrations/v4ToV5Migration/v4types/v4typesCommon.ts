import type { ImageSourcePropType } from 'react-native';

export type IV4LocaleSymbol =
  | 'en-US'
  | 'zh-CN'
  | 'zh-HK'
  | 'ja-JP'
  | 'ko-KR'
  | 'bn'
  | 'de'
  | 'es'
  | 'fil'
  | 'fr-FR'
  | 'hi-IN'
  | 'it-IT'
  | 'mn-MN'
  | 'pt'
  | 'ru'
  | 'th-TH'
  | 'uk-UA'
  | 'vi'
  | 'id'
  | 'pt-BR'
  | 'system';

export enum EV4OnekeyDomain {
  ONEKEY_SO = 'onekey.so',
  ONEKEY_CN = 'onekeycn.com',
}
export enum EV4ValidationFields {
  Payment = 'Payment', // form__create_transactions
  Wallet = 'Wallet', // form__create_delete_wallets
  Account = 'Account', // form__create_delete_accounts
  Secret = 'Secret', // form__view_recovery_phrase_private_key
}
export type IV4WalletSwitchItem = {
  logo: ImageSourcePropType;
  title: string;
  propertyKeys: string[];
  enable: boolean;
};

// export type FirmwareUpdate = {
//   forceFirmware: boolean;
//   forceBle: boolean;
//   firmware?: SYSFirmwareInfo;
//   ble?: BLEFirmwareInfo;
// };

export enum EV4DBAccountType {
  SIMPLE = 'simple',
  UTXO = 'utxo',
  VARIANT = 'variant',
  // used for allNetworks
  FAKE = 'FAKE',
}
