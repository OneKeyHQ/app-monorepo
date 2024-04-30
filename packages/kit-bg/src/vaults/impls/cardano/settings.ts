import {
  COINTYPE_ADA,
  COINTYPE_ETH,
  IMPL_ADA,
  IMPL_EVM,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'CARDANO',
    // FIXME: change to Shelley
    labelKey: 'form__bip44_standard',
    template: `m/1852'/${COINTYPE_ADA}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_ADA,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_ADA,
  coinTypeDefault: COINTYPE_ADA,
  accountType: EDBAccountType.UTXO,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  minTransferAmount: '1',

  isUtxo: true,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: true,
  editFeeEnabled: false,
  replaceTxEnabled: false,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'ed25519',
      addressPrefix: '',
    },
  },
};

export default Object.freeze(settings);
