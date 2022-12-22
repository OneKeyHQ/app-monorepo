import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  privateKeyExportEnabled: true,
  tokenEnabled: true,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUTXOModel: false,
  activateAccountRequired: true,
  activateTokenRequired: true,

  feeInfoEditable: true,
  minGasLimit: 1000,
});

export default settings;
