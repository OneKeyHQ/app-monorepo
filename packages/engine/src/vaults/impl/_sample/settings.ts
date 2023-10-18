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
      prefix: '',
      category: '',
      template: '',
      coinType: '',
    },
  },
});

export default settings;
