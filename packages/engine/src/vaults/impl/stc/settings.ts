import {
  COINTYPE_STC,
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

  accountNameInfo: {
    default: {
      prefix: 'STC',
      category: `44'/${COINTYPE_STC}'`,
      template: `m/44'/${COINTYPE_STC}'/0'/0'/${INDEX_PLACEHOLDER}'`,
      coinType: COINTYPE_STC,
    },
  },
});

export default settings;
