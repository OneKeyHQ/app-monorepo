import { IVaultSettings } from '../../types';

const settings: IVaultSettings = {
  privateKeyExportEnabled: true,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUTXOModel: false,
  activateAccountRequired: false,
  activateTokenRequired: false,

  feeInfoEditable: true,
  minGasLimit: 50,
};

export default settings;
