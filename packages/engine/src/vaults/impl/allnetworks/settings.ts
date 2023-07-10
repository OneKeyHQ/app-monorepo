import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: false,
  privateKeyExportEnabled: false,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: false,
  watchingAccountEnabled: false,
  externalAccountEnabled: false,
  hardwareAccountEnabled: true,

  isUTXOModel: false,
  activateTokenRequired: false,

  accountNameInfo: {},

  txExtraInfo: [],
});

export default settings;
