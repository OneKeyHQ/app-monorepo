import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = {
  feeInfoEditable: false,
  privateKeyExportEnabled: true,
  tokenEnabled: true,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  watchingAccountEnabled: true,
  externalAccountEnabled: false,
  hardwareAccountEnabled: true,

  isUTXOModel: false,
  activateTokenRequired: true,
};

export default settings;
