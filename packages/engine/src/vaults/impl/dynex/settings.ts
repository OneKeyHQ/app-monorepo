import {
  COINTYPE_DYNEX,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: false,
  privateKeyExportEnabled: false,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: false,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: false,
  softwareAccountDisabled: true,

  isUTXOModel: true,

  hideInAllNetworksMode: true,

  withPaymentId: true,

  enabledOnClassicOnly: true,

  minTransferAmount: '0.000000001',

  accountNameInfo: {
    default: {
      prefix: 'DNX',
      category: `44'/${COINTYPE_DYNEX}'`,
      template: `m/44'/${COINTYPE_DYNEX}'/0'/0'/${INDEX_PLACEHOLDER}'`,
      coinType: COINTYPE_DYNEX,
      label: 'Default',
      subDesc: `m/44'/${COINTYPE_DYNEX}'/0'/0'/x'`,
    },
  },
});

export default settings;
