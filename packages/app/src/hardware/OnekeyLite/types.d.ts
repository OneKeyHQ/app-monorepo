export type Callback<T> = (
  error: CallbackError | null,
  data: T | null,
  state: CardInfo | null,
) => void;

export type NativeCallback<T> = (
  error: string | null,
  data: T | null,
  state: string | null,
) => void;

export type CallbackError = { code: number; message: string | null } | null;

export type CardInfo = {
  hasBackup: boolean;
  isNewCard: boolean;
  serialNum: string;
  pinRetryCount: number;
} | null;
