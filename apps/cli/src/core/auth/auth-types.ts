import type { SecureStorageBackend } from '../../infra/keychain-storage';
import type {
  ICreateTransferPairingSessionParams,
  ITransferPairingSession,
} from '../prime-transfer/transfer-types';

type IAuthLoginMethod = 'app_transfer';
type IAuthWalletKind = 'hd';
type IAuthStatus = 'authenticated' | 'unauthenticated';

interface IAuthSessionMetadata {
  schemaVersion: number;
  loginMethod: IAuthLoginMethod;
  walletKind: IAuthWalletKind;
  displayAddress: string;
  importedAt: string;
  sourceLabel: string;
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
}

export const AUTH_DEFAULT_EVM_NETWORK_ID = 'evm--1';

export type {
  IAppTransferLoginResult as AppTransferLoginResult,
  IAuthLoginMethod as AuthLoginMethod,
  IAuthSessionMetadata as AuthSessionMetadata,
  IAuthStatus as AuthStatus,
  IAuthWalletKind as AuthWalletKind,
  IPersistAuthSessionInput as PersistAuthSessionInput,
  IResolvedAuthSession as ResolvedAuthSession,
  IStartAppTransferLoginInput as StartAppTransferLoginInput,
};
