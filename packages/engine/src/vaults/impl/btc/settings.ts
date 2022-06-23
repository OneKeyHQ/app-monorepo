import { IVaultSettings } from '../../types';

const settings: IVaultSettings = {
  feeInfoEditable: true,
  privateKeyExportEnabled: true,
  tokenEnabled: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  watchingAccountEnabled: true,

  minTransferAmount: '0.00000546',
};

export default settings;
