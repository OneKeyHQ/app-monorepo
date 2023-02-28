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

  subNetworkSettings: {
    'cosmos--osmosis-1': {
      minGasPrice: '0',
    },
  },
});

export default settings;
