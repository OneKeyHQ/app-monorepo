import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: false,
  privateKeyExportEnabled: true,
  tokenEnabled: true,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUTXOModel: false,
  supportBatchTransfer: true,
  maxActionsInTx: 8,
});

export default settings;
