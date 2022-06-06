import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IVaultSettings } from '../../types';

const settings: IVaultSettings = {
  feeInfoEditable: true,
  privateKeyExportEnabled: true,
  tokenEnabled: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: !platformEnv.isNative,
  watchingAccountEnabled: true,
};

export default settings;
