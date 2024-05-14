import {
  COINTYPE_DOT,
  COINTYPE_ETH,
  IMPL_DOT,
  IMPL_EVM,
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

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: true,
  feeUTXORequired: false,
  editFeeEnabled: false,
  replaceTxEnabled: false,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'ed25519',
      addressPrefix: '0',
    },
    'dot--polkadot': {
      curve: 'ed25519',
      addressPrefix: '0',
    },
  },
};

export default Object.freeze(settings);
