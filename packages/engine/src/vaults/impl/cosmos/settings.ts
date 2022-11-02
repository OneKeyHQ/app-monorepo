import { IVaultSettings } from '../../types';

const settings: IVaultSettings = {
  feeInfoEditable: true,
  privateKeyExportEnabled: false,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: false,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUTXOModel: false,
};

export default settings;
