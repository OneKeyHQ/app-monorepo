import type {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
} from '@onekeyhq/shared/src/consts/dbConsts';

import type { SecureStorageBackend } from '../../infra/keychain-storage';
import type {
  ICreateTransferPairingSessionParams,
  ITransferPairingSession,
} from '../prime-transfer/transfer-types';

/** CLI login-method tags (Bot Wallet pairing vs hardware device). */
export const AUTH_LOGIN_METHOD_APP_TRANSFER = 'app_transfer';
export const AUTH_LOGIN_METHOD_HARDWARE = 'hardware';

/**
 * Passphrase entry mode for hidden-wallet sessions. Persisted so follow-up
 * commands know how to re-prompt; the passphrase value itself is never
 * written to disk.
 */
export const PASSPHRASE_MODE_NONE = 'none';
export const PASSPHRASE_MODE_ON_HOST = 'on_host';
export const PASSPHRASE_MODE_ON_DEVICE = 'on_device';

type IAuthLoginMethod =
  | typeof AUTH_LOGIN_METHOD_APP_TRANSFER
  | typeof AUTH_LOGIN_METHOD_HARDWARE;

/** Aligned with kit-bg's `IDBWalletType` subset for cross-surface interop. */
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
