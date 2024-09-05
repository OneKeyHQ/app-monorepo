import {
  COINTYPE_ALPH,
  IMPL_ALPH,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import { NATIVE_TOKEN_ADDRESS } from './sdkAlph/utils';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

// default: 0
// bip340-schnorr: 1 not supported
const KEY_TYPE_NUM = 0;

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'ALPH',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_ALPH}'/${KEY_TYPE_NUM}'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_ALPH,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_ALPH,
  coinTypeDefault: COINTYPE_ALPH,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: false,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,
  softwareAccountDisabled: true,

  supportedDeviceTypes: ['classic1s', 'pro'],

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: false,
  replaceTxEnabled: false,
  estimatedFeePollingInterval: 30,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
      nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
  },
};

export default Object.freeze(settings);
