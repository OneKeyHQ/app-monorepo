import {
  COINTYPE_NEXA,
  INDEX_PLACEHOLDER,
  IS_CHANGE_ADDRESS,
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

  minGasLimit: 10,
  minTransferAmount: '0.00000546',

  isUTXOModel: true,

  accountNameInfo: {
    default: {
      prefix: 'NEXA',
      category: `44'/${COINTYPE_NEXA}'`,
      template: `m/44'/${COINTYPE_NEXA}'/0'/${IS_CHANGE_ADDRESS}/${INDEX_PLACEHOLDER}`,
      coinType: COINTYPE_NEXA,
      label: 'Legacy',
      subDesc: 'BIP32, P2SH, Base32.',
    },
  },
});

export default settings;
