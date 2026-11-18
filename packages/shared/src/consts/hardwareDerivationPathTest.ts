import { ETranslations } from '../locale';

import {
  HARDWARE_CLOUD_SYNC_AUTH_PATH,
  HARDWARE_CLOUD_SYNC_PATH,
} from './hardwareCloudSyncConsts';

// Deliberately unrelated to both Cloud sync authentication and key material.
export const HARDWARE_PATH_TEST_MESSAGE =
  'OneKey developer derivation path test. This message does not authorize any action.';

export type IHardwarePathTestMethod =
  | 'btcGetPublicKey'
  | 'btcGetAddress'
  | 'btcSignMessage';

export type IHardwarePathTestSignType = 'default' | 'ecdsa' | 'bip322-simple';

export type IHardwarePathTestRequest = {
  testId: string;
  connectId: string;
  path: string;
  method: IHardwarePathTestMethod;
  signType: IHardwarePathTestSignType;
};

type IHardwarePathTestPreset = { path: string } & (
  | { labelKey: ETranslations; values?: { index: string } }
  | { label: string }
);

export const HARDWARE_PATH_TEST_PRESETS: IHardwarePathTestPreset[] = [
  {
    labelKey: ETranslations.dev_hw_path_cloud_key__title,
    path: HARDWARE_CLOUD_SYNC_PATH,
  },
  {
    labelKey: ETranslations.dev_hw_path_cloud_auth__title,
    path: HARDWARE_CLOUD_SYNC_AUTH_PATH,
  },
  ...['999999', '1000000', '1000001'].map((index) => ({
    labelKey: ETranslations.dev_hw_path_index__title,
    values: { index },
    path: `m/44'/0'/924823361'/1/${index}`,
  })),
  {
    labelKey: ETranslations.dev_hw_path_account_zero__title,
    path: "m/44'/0'/0'/1/369775",
  },
  { label: 'BIP44 (P2PKH)', path: "m/44'/0'/0'/0/0" },
  { label: 'BIP49 (P2SH-P2WPKH)', path: "m/49'/0'/0'/0/0" },
  { label: 'BIP84 (P2WPKH)', path: "m/84'/0'/0'/0/0" },
  { label: 'BIP86 (P2TR)', path: "m/86'/0'/0'/0/0" },
];
