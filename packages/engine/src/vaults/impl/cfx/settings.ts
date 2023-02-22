import {
  COINTYPE_CFX,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: true,
  privateKeyExportEnabled: true,
  tokenEnabled: true,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUTXOModel: false,
  transactionIdPattern: '^0x[0-9a-fA-F]{64}$',

  accountNameInfo: {
    default: {
      prefix: 'CFX',
      category: `44'/${COINTYPE_CFX}'`,
      template: `m/44'/503'/0'/0/${INDEX_PLACEHOLDER}`,
      coinType: COINTYPE_CFX,
    },
  },
});

export default settings;
