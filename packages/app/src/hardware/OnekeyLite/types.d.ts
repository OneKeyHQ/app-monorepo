export type Callback<T> = (
  error: CallbackError | null,
  data: T | null,
  state: CardInfo | null,
) => void;

export type CallbackError = { code: number; message: string | null } | null;

export type CardInfo = {
  hasBackup: boolean;
  isNewCard: boolean;
  serialNum: string;
  pinRetryCount: number;
} | null;

export enum CardErrors {
  InitChannel = 1000,
  NotExistsNFC = 1001,
  NotEnableNFC = 1002,
  NotNFCPermission = 1003,

  ConnectionFail = 2001,
  InterruptError = 2002,
  DeviceMismatch = 2003,
  UserCancel = 2004,

  PasswordWrong = 3001,
  InputPasswordEmpty = 3002,
  NotSetPassword = 3003,
  InitPasswordError = 3004,
  CardLock = 3005,
  UpperErrorAutoReset = 3006,

  ExecFailure = 4000,
  InitializedError = 4001,
  NotInitializedError = 4002,
}
