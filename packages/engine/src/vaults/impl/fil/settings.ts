import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: false,
  privateKeyExportEnabled: true,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  watchingAccountEnabled: true,
  externalAccountEnabled: false,
  hardwareAccountEnabled: true,

  isUTXOModel: false,
});

export default settings;
