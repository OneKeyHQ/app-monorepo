import { IVaultSettings } from '../../types';

const settings: IVaultSettings = {
  feeInfoEditable: true,
  privateKeyExportEnabled: true,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  watchingAccountEnabled: true,

  isUTXOModel: false,
};

export default settings;
