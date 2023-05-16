import {
  COINTYPE_COSMOS,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: true,
  privateKeyExportEnabled: true,
  tokenEnabled: true,
  txCanBeReplaced: false,
  withDestinationTag: true,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUTXOModel: false,

  minTransferAmount: '0.0000001',

  signOnlyReturnFullTx: true,

  accountNameInfo: {
    default: {
      prefix: 'COSMOS',
      category: `44'/${COINTYPE_COSMOS}'`,
      template: `m/44'/${COINTYPE_COSMOS}'/0'/0/${INDEX_PLACEHOLDER}`,
      coinType: COINTYPE_COSMOS,
    },
  },

  subNetworkSettings: {
    'cosmos--osmosis-1': {
      minGasPrice: '0',
    },
  },
});

export default settings;
