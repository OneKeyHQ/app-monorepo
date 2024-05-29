import { SUI_TYPE_ARG } from '@mysten/sui.js';

import {
  COINTYPE_SUI,
  IMPL_SUI,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'SUI',
    labelKey: 'form__bip44_standard',
    template: `m/44'/${COINTYPE_SUI}'/${INDEX_PLACEHOLDER}'/0'/0'`,
    coinType: COINTYPE_SUI,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_SUI,
  coinTypeDefault: COINTYPE_SUI,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: true,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'ed25519',
      addressPrefix: '',
      nativeTokenAddress: SUI_TYPE_ARG,
    },
  },
};

export default Object.freeze(settings);
