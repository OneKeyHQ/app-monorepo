import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: true,
  watchingAccountEnabled: true,
} as IVaultSettings);

export default settings;
