import {
  COINTYPE_NERVOS,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: false,
  privateKeyExportEnabled: false,
  tokenEnabled: true,
  txCanBeReplaced: false,

  importedAccountEnabled: false,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: false,

  minTransferAmount: '0.00000546',
  isUTXOModel: false,

  hideInAllNetworksMode: true,

  accountNameInfo: {
    default: {
      prefix: 'CKB',
      category: `44'/${COINTYPE_NERVOS}'`,
      template: `m/44'/${COINTYPE_NERVOS}'/0'/0/${INDEX_PLACEHOLDER}`,
      coinType: COINTYPE_NERVOS,
    },
  },
});

export default settings;
