import {
  COINTYPE_DOT,
  IMPL_DOT,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'DOT',
    template: `m/44'/${COINTYPE_DOT}'/${INDEX_PLACEHOLDER}'/0'/0'`,
    coinType: COINTYPE_DOT,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_DOT,
  coinTypeDefault: COINTYPE_DOT,
  accountType: EDBAccountType.VARIANT,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  dappInteractionEnabled: true,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: true,
  feeUTXORequired: false,
  editFeeEnabled: false,
  replaceTxEnabled: false,
  transferZeroNativeTokenEnabled: true,
  estimatedFeePollingInterval: 120,

  defaultFeePresetIndex: 0,

  saveConfirmedTxsEnabled: true,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'ed25519',
      addressPrefix: '0',
      nativeTokenAddress: 'DOT',
    },
    'dot--polkadot': {
      curve: 'ed25519',
      addressPrefix: '0',
      nativeTokenAddress: 'DOT',
    },
    'dot--astar': {
      curve: 'ed25519',
      addressPrefix: '5',
      nativeTokenAddress: 'ASTR',
    },
    'dot--kusama': {
      curve: 'ed25519',
      addressPrefix: '2',
      nativeTokenAddress: 'KSM',
    },
    'dot--manta': {
      curve: 'ed25519',
      addressPrefix: '77',
      nativeTokenAddress: 'MANTA',
    },
    'dot--joystream': {
      curve: 'ed25519',
      addressPrefix: '126',
      nativeTokenAddress: 'JOY',
    },
  },
};

export default Object.freeze(settings);
