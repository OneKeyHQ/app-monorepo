import {
  COINTYPE_DYNEX,
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
  softwareAccountDisabled: true,

  isUTXOModel: false,

  hideInAllNetworksMode: true,

  withPaymentId: true,

  accountNameInfo: {
    default: {
      prefix: 'DNX',
      category: `44'/${COINTYPE_DYNEX}'`,
      template: `m/44'/${COINTYPE_DYNEX}'/0'/0'/${INDEX_PLACEHOLDER}'`,
      coinType: COINTYPE_DYNEX,
    },
  },
});

export default settings;
