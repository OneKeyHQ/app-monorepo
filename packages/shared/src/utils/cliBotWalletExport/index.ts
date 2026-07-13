export {
  BOT_WALLET_HASH_INTERNALS,
  buildBotWalletHash,
  isBotWalletHash,
} from './botWalletHash';

export {
  ENCRYPT_LAYOUT,
  decryptCredential,
  encryptCredential,
  secureWipe,
} from './encrypt';
export type { IEncryptCredentialResult } from './encrypt';

export { exportBotWalletToCli } from './exportToCli';
export type {
  IExportBotWalletToCliDeps,
  IExportBotWalletToCliInput,
} from './exportToCli';

export {
  CLI_BOT_WALLET_CLIENT_INTERNALS,
  registerKey,
  revokeKey,
} from './register';
export type {
  ICliBotWalletKeyClientLogger,
  ICliBotWalletKeyClientOptions,
  IRegisterKeyInput,
  IRegisterKeyResponse,
} from './register';
