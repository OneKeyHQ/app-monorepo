import {
  COINTYPE_ALGO,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: false,
  privateKeyExportEnabled: true,
  tokenEnabled: true,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  watchingAccountEnabled: true,
  externalAccountEnabled: false,
  hardwareAccountEnabled: true,

  isUTXOModel: false,
  activateTokenRequired: true,

  accountNameInfo: {
    default: {
      prefix: 'ALGO',
      category: `44'/${COINTYPE_ALGO}'`,
      template: `m/44'/${COINTYPE_ALGO}'/0'/0'/${INDEX_PLACEHOLDER}'`,
      coinType: COINTYPE_ALGO,
    },
  },
});

export default settings;
