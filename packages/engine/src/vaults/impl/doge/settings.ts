import {
  COINTYPE_DOGE,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: true,
  privateKeyExportEnabled: true,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  minTransferAmount: '0.0099999',

  isUTXOModel: true,

  accountNameInfo: {
    default: {
      prefix: 'DOGE',
      category: `44'/${COINTYPE_DOGE}'`,
      template: `m/44'/${COINTYPE_DOGE}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_DOGE,
      label: 'Legacy',
      subDesc: 'BIP44, P2PKH, Base58.',
    },
  },

  showUsedAddress: true,
});

export default settings;
