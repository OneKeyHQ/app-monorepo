import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = {
  feeInfoEditable: false,
  privateKeyExportEnabled: false,
  tokenEnabled: true,
  txCanBeReplaced: false,

  importedAccountEnabled: false,
  hardwareAccountEnabled: false,
  externalAccountEnabled: false,
  watchingAccountEnabled: false,

  isUTXOModel: false,
};

export default settings;
