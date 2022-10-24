import { IVaultSettings } from '../../types';

const settings: IVaultSettings = {
  feeInfoEditable: true,
  privateKeyExportEnabled: true,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUTXOModel: true,
};

export default settings;
