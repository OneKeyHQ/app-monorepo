import {
  COINTYPE_XRP,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: true,
  privateKeyExportEnabled: true,
  tokenEnabled: false,
  txCanBeReplaced: false,
  withDestinationTag: true,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  minTransferAmount: '0.001',

  isUTXOModel: false,

  cannotSendToSelf: true,

  accountNameInfo: {
    default: {
      prefix: 'RIPPLE',
      category: `44'/${COINTYPE_XRP}'`,
      template: `m/44'/${COINTYPE_XRP}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_XRP,
    },
  },
});

export default settings;
