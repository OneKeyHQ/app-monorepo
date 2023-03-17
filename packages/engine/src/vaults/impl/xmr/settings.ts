import {
  COINTYPE_XMR,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: false,
  privateKeyExportEnabled: true,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  watchingAccountEnabled: false,
  externalAccountEnabled: false,
  hardwareAccountEnabled: false,

  isUTXOModel: false,

  addressDerivationDisabled: true,
  validationRequired: true,
  disabledInExtension: true,

  accountNameInfo: {
    default: {
      prefix: 'XMR',
      category: `44'/${COINTYPE_XMR}'`,
      template: `m/44'/${COINTYPE_XMR}'/0'/0/${INDEX_PLACEHOLDER}`,
      coinType: COINTYPE_XMR,
    },
  },
});

export default settings;
