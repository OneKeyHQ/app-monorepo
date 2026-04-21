import type { SecureStorageBackend } from '../../infra/keychain-storage';
import type {
  ICreateTransferPairingSessionParams,
  ITransferPairingSession,
} from '../prime-transfer/transfer-types';

type IAuthLoginMethod = 'app_transfer' | 'hardware';
type IAuthWalletKind = 'hd' | 'hardware';
type IAuthStatus = 'authenticated' | 'unauthenticated';

/**
 * How the passphrase is obtained for hidden wallet sessions.
 * - 'none': standard wallet (useEmptyPassphrase)
 * - 'on_host': passphrase entered via pinentry on host machine each time
 * - 'on_device': passphrase entered on device screen each time
 *
 * The passphrase value itself and passphraseState are NEVER persisted;
 * only the mode is stored so subsequent commands know how to re-prompt.
 */
type IPassphraseMode = 'none' | 'on_host' | 'on_device';

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
