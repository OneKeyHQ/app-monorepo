import {
  COINTYPE_NEAR,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: false,
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
      prefix: 'NEAR',
      category: `44'/${COINTYPE_NEAR}'`,
      template: `m/44'/${COINTYPE_NEAR}'/${INDEX_PLACEHOLDER}'`,
      coinType: COINTYPE_NEAR,
    },
  },
});

export default settings;
