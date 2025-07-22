import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import {
  COINTYPE_DOT,
  IMPL_DOT,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'DOT',
    labelKey: ETranslations.bip44__standard,
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

  supportExportedSecretKeys: [
    ECoreApiExportedSecretKeyType.privateKey,
    // ECoreApiExportedSecretKeyType.publicKey,
  ],

  dappInteractionEnabled: true,
  // dApp not edit fee
  preCheckDappTxFeeInfoRequired: true,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: true,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,
  transferZeroNativeTokenEnabled: true,
  estimatedFeePollingInterval: 120,

  defaultFeePresetIndex: 0,

  customRpcEnabled: true,

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
      genesisHash:
        '0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3',
    },
    'dot--astar': {
      curve: 'ed25519',
      addressPrefix: '5',
      nativeTokenAddress: 'ASTR',
      genesisHash:
        '0x9eb76c5184c4ab8679d2d5d819fdf90b9c001403e9e17da2e14b6d8aec4029c6',
    },
    'dot--kusama': {
      curve: 'ed25519',
      addressPrefix: '2',
      nativeTokenAddress: 'KSM',
      genesisHash:
        '0xb0a8d493285c2df73290dfb7e61f870f17b41801197a149ca93654499ea3dafe',
    },
    'dot--manta': {
      curve: 'ed25519',
      addressPrefix: '77',
      nativeTokenAddress: 'MANTA',
      genesisHash:
        '0xf3c7ad88f6a80f366c4be216691411ef0622e8b809b1046ea297ef106058d4eb',
    },
    'dot--joystream': {
      curve: 'ed25519',
      addressPrefix: '126',
      nativeTokenAddress: 'JOY',
      genesisHash:
        '0x6b5e488e0fa8f9821110d5c13f4c468abcd43ce5e297e62b34c53c3346465956',
    },
  },
};

export default Object.freeze(settings);
