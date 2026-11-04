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

export const HARDWARE_PATH_TEST_PRESETS = [
  { label: 'Cloud key (current)', path: HARDWARE_CLOUD_SYNC_PATH },
  { label: 'Cloud sign-in (current)', path: HARDWARE_CLOUD_SYNC_AUTH_PATH },
  { label: 'Same account, index 999999', path: "m/44'/0'/924823361'/1/999999" },
  {
    label: 'Same account, index 1000000',
    path: "m/44'/0'/924823361'/1/1000000",
  },
  {
    label: 'Same account, index 1000001',
    path: "m/44'/0'/924823361'/1/1000001",
  },
  { label: 'Account 0, current key index', path: "m/44'/0'/0'/1/835069775" },
  { label: 'BIP44 Legacy', path: "m/44'/0'/0'/0/0" },
  { label: 'BIP49 Nested SegWit', path: "m/49'/0'/0'/0/0" },
  { label: 'BIP84 Native SegWit', path: "m/84'/0'/0'/0/0" },
  { label: 'BIP86 Taproot', path: "m/86'/0'/0'/0/0" },
];
