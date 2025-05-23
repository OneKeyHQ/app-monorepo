import BigNumber from 'bignumber.js';

import { DUST_AMOUNT } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa';
import {
  EAddressEncodings,
  ECoreApiExportedSecretKeyType,
} from '@onekeyhq/core/src/types';
import {
  COINTYPE_KASPA,
  IMPL_KASPA,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoMapBase,
  IVaultSettings,
} from '../../types';

export type IAccountDeriveInfoMapKaspa = IAccountDeriveInfoMapBase & {
  default: IAccountDeriveInfo;
  kaspaOfficial: IAccountDeriveInfo;
};
export type IAccountDeriveTypesKaspa = keyof IAccountDeriveInfoMapKaspa;

const accountDeriveInfo: IAccountDeriveInfoMapKaspa = {
  default: {
    namePrefix: 'KASPA',
    label: 'Kaspa OneKey',
    template: `m/44'/${COINTYPE_KASPA}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_KASPA,
    desc: 'Kaspa OneKey address',
    useAddressEncodingDerive: true,
  },
  kaspaOfficial: {
    namePrefix: 'KASPA Official',
    label: 'Kaspa Official',
    template: `m/44'/${COINTYPE_KASPA}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_KASPA,
    addressEncoding: EAddressEncodings.KASPA_ORG,
    idSuffix: EAddressEncodings.KASPA_ORG,
    desc: 'Kaspa Official address',
    useAddressEncodingDerive: true,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_KASPA,
  coinTypeDefault: COINTYPE_KASPA,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  supportExportedSecretKeys: [
    ECoreApiExportedSecretKeyType.privateKey,
    // ECoreApiExportedSecretKeyType.publicKey,
  ],

  defaultFeePresetIndex: 1,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,
  estimatedFeePollingInterval: 300,

  customRpcEnabled: true,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },

  nativeMinTransferAmount: new BigNumber(DUST_AMOUNT).shiftedBy(-8).toFixed(),
  isNativeTokenContractAddressEmpty: false,

  afterSendTxActionEnabled: true,
};

export default Object.freeze(settings);
