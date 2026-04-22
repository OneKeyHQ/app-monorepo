import type {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
} from '@onekeyhq/shared/src/consts/dbConsts';

import type { SecureStorageBackend } from '../../infra/keychain-storage';
import type {
  ICreateTransferPairingSessionParams,
  ITransferPairingSession,
} from '../prime-transfer/transfer-types';

/**
 * CLI-specific login method tag. `'app_transfer'` covers the Bot Wallet
 * pairing flow; `'hardware'` covers the hardware-device login flow.
 * (No kit-bg equivalent — shared across the two `auth login` variants.)
 */
export const AUTH_LOGIN_METHOD_APP_TRANSFER = 'app_transfer';
export const AUTH_LOGIN_METHOD_HARDWARE = 'hardware';

/**
 * Passphrase entry mode for hidden-wallet hardware sessions. The mode is
 * persisted so subsequent commands know how to re-prompt; the passphrase
 * value and passphraseState are never written to disk.
 *   - 'none': standard wallet (useEmptyPassphrase)
 *   - 'on_host': entered via pinentry on the host each time
 *   - 'on_device': entered on the device screen each time
 */
export const PASSPHRASE_MODE_NONE = 'none';
export const PASSPHRASE_MODE_ON_HOST = 'on_host';
export const PASSPHRASE_MODE_ON_DEVICE = 'on_device';

type IAuthLoginMethod =
  | typeof AUTH_LOGIN_METHOD_APP_TRANSFER
  | typeof AUTH_LOGIN_METHOD_HARDWARE;

/**
 * Wallet kind tag. Aligned with kit-bg's `IDBWalletType` subset so a
 * session produced by the CLI can be recognized by shared account utils
 * (e.g. `accountUtils.isHdWallet` / `isHwWallet` checks walletId prefix,
 * but the kind label should also match for future interop).
 */
type IAuthWalletKind = typeof WALLET_TYPE_HD | typeof WALLET_TYPE_HW;

type IAuthStatus = 'authenticated' | 'unauthenticated';

type IPassphraseMode =
  | typeof PASSPHRASE_MODE_NONE
  | typeof PASSPHRASE_MODE_ON_HOST
  | typeof PASSPHRASE_MODE_ON_DEVICE;

interface IDeviceInfo {
  connectId: string;
  deviceId: string;
  deviceLabel: string;
}

interface IAuthSessionMetadata {
  schemaVersion: number;
  loginMethod: IAuthLoginMethod;
  walletKind: IAuthWalletKind;
  displayAddress: string;
  importedAt: string;
  sourceLabel: string;
  device?: IDeviceInfo;
  passphraseMode?: IPassphraseMode;
}

interface IPersistAuthSessionInput {
  encryptedMnemonic: Buffer;
  encryptionKey: string;
  session: IAuthSessionMetadata;
}

type IStartAppTransferLoginInput = ICreateTransferPairingSessionParams;
type IAppTransferLoginResult = ITransferPairingSession;

interface IResolvedAuthSession {
  authStatus: IAuthStatus;
  hasSecrets: boolean;
  storageBackend: SecureStorageBackend;
  loginMethod?: IAuthLoginMethod;
  walletKind?: IAuthWalletKind;
  displayAddress?: string;
  importedAt?: string;
  sourceLabel?: string;
  device?: IDeviceInfo;
  passphraseMode?: IPassphraseMode;
}

export const AUTH_DEFAULT_EVM_NETWORK_ID = 'evm--1';

export type {
  IAppTransferLoginResult as AppTransferLoginResult,
  IAuthLoginMethod as AuthLoginMethod,
  IAuthSessionMetadata as AuthSessionMetadata,
  IAuthStatus as AuthStatus,
  IAuthWalletKind as AuthWalletKind,
  IDeviceInfo as DeviceInfo,
  IPassphraseMode as PassphraseMode,
  IPersistAuthSessionInput as PersistAuthSessionInput,
  IResolvedAuthSession as ResolvedAuthSession,
  IStartAppTransferLoginInput as StartAppTransferLoginInput,
};
