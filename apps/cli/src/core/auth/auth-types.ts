import type { SecureStorageBackend } from '../../infra/keychain-storage';
import type {
  ICreateTransferPairingSessionParams,
  ITransferPairingSession,
} from '../prime-transfer/transfer-types';

type IAuthLoginMethod = 'mnemonic' | 'app_transfer';
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

interface IMnemonicLoginResult {
  address: string;
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

export type {
  IAppTransferLoginResult as AppTransferLoginResult,
  IAuthLoginMethod as AuthLoginMethod,
  IAuthSessionMetadata as AuthSessionMetadata,
  IAuthStatus as AuthStatus,
  IAuthWalletKind as AuthWalletKind,
  IMnemonicLoginResult as MnemonicLoginResult,
  IPersistAuthSessionInput as PersistAuthSessionInput,
  IResolvedAuthSession as ResolvedAuthSession,
  IStartAppTransferLoginInput as StartAppTransferLoginInput,
};
