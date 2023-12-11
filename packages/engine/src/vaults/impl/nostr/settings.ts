import {
  COINTYPE_NOSTR,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: false,
  privateKeyExportEnabled: false,
  tokenEnabled: true,
  txCanBeReplaced: false,

  importedAccountEnabled: false,
  hardwareAccountEnabled: false,
  externalAccountEnabled: false,
  watchingAccountEnabled: false,

  isUTXOModel: false,

  accountNameInfo: {
    default: {
      prefix: 'Nostr',
      category: `44'/${COINTYPE_NOSTR}'`,
      template: `m/44'/${COINTYPE_NOSTR}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_NOSTR,
    },
  },
});

export default settings;
