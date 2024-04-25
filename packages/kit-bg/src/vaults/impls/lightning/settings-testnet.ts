import {
  COINTYPE_LIGHTNING_TESTNET,
  IMPL_LIGHTNING_TESTNET,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'TLightning',
    template: `m/44'/${COINTYPE_LIGHTNING_TESTNET}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_LIGHTNING_TESTNET,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_LIGHTNING_TESTNET,
  coinTypeDefault: COINTYPE_LIGHTNING_TESTNET,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: false,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: false,

  isUtxo: false,
  isSingleToken: true,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: false,
  replaceTxEnabled: false,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },
  validationRequired: true,
};

export default Object.freeze(settings);
