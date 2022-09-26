import { IVaultSettings } from '../../types';

const settings: IVaultSettings = {
  privateKeyExportEnabled: true,
  tokenEnabled: true,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: false,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUTXOModel: false,
  activateAccountRequired: true,
  activateTokenRequired: true,

  feeInfoEditable: true,
  minGasLimit: 2000,
};

export default settings;
