export type Callback<T> = (
  error: CallbackError | null,
  data: T | null,
  state: CardInfo | null,
) => void;

export type CallbackError = { code: number; message: string | null };

export type CardInfo = {
  hasBackup: boolean;
  isNewCard: boolean;
  serialNum: string;
  pinRetryCount: number;
};
