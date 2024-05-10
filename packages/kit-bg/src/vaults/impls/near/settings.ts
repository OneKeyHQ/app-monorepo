import {
  COINTYPE_NEAR,
  IMPL_NEAR,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'NEAR',
    labelKey: 'form__bip44_standard',
    template: `m/44'/${COINTYPE_NEAR}'/${INDEX_PLACEHOLDER}'`,
    coinType: COINTYPE_NEAR,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_NEAR,
  coinTypeDefault: COINTYPE_NEAR,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: true,
  watchingAccountEnabled: true,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: true,
  feeUTXORequired: false,
  editFeeEnabled: false,
  replaceTxEnabled: false,
  onChainHistoryDisabled: true,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'ed25519',
      addressPrefix: '',
    },
  },
};

export default Object.freeze(settings);
