import {
  COINTYPE_COSMOS,
  IMPL_COSMOS,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoMapBase,
  IVaultSettings,
} from '../../types';

export type IAccountDeriveInfoMapCosmos = IAccountDeriveInfoMapBase & {
  default: IAccountDeriveInfo;
};
export type IAccountDeriveTypesCosmos = keyof IAccountDeriveInfoMapCosmos;

const accountDeriveInfo: IAccountDeriveInfoMapCosmos = {
  default: {
    namePrefix: 'COSMOS',
    template: `m/44'/${COINTYPE_COSMOS}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_COSMOS,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_COSMOS,
  coinTypeDefault: COINTYPE_COSMOS,
  accountType: EDBAccountType.VARIANT,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,
  onChainHistoryDisabled: true,
  estimatedFeePollingInterval: 120 * 1000,

  minTransferAmount: '0.0000001',

  defaultFeePresetIndex: 1,

  withMemo: true,
  memoMaxLength: 512,

  accountDeriveInfo,
  networkInfo: {
    default: {
      addressPrefix: '',
      curve: 'secp256k1',
    },
    'cosmos--cosmoshub-4': {
      addressPrefix: 'cosmos',
      curve: 'secp256k1',
      nativeTokenAddress: 'uatom',
    },
    'cosmos--theta-testnet-001': {
      addressPrefix: 'cosmos',
      curve: 'secp256k1',
      nativeTokenAddress: 'uatom',
    },
    'cosmos--osmosis-1': {
      addressPrefix: 'osmo',
      curve: 'secp256k1',
      nativeTokenAddress: 'uosmo',
    },
    'cosmos--akashnet-2': {
      addressPrefix: 'akash',
      curve: 'secp256k1',
      nativeTokenAddress: 'uakt',
    },
    'cosmos--crypto-org-chain-mainnet-1': {
      addressPrefix: 'cro',
      curve: 'secp256k1',
      nativeTokenAddress: 'basecro',
    },
    'cosmos--fetchhub-4': {
      addressPrefix: 'fetch',
      curve: 'secp256k1',
      nativeTokenAddress: 'afet',
    },
    'cosmos--juno-1': {
      addressPrefix: 'juno',
      curve: 'secp256k1',
      nativeTokenAddress: 'ujuno',
    },
    'cosmos--secret-4': {
      addressPrefix: 'secret',
      curve: 'secp256k1',
      nativeTokenAddress: 'uscrt',
    },
    'cosmos--celestia': {
      addressPrefix: 'celestia',
      curve: 'secp256k1',
      nativeTokenAddress: 'utia',
    },
  },
};

export default Object.freeze(settings);
