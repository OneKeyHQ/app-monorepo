import {
  COINTYPE_ADA,
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

  minTransferAmount: '1',

  isUTXOModel: true,

  hideInAllNetworksMode: true,

  accountNameInfo: {
    default: {
      prefix: 'CARDANO',
      category: `1852'/${COINTYPE_ADA}'`,
      template: `m/1852'/${COINTYPE_ADA}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_ADA,
      label: 'Shelley',
      subDesc: `m/1852'/${COINTYPE_ADA}'/*'/0/0`,
    },
  },
});

export default settings;
