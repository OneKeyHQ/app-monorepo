type IRecoveryPhraseProtectedDialogType =
  | 'recoveryPhrase'
  | 'sensitiveInformation';

type IUseRecoveryPhraseProtectedOptions = {
  dialogType?: IRecoveryPhraseProtectedDialogType;
  enabled?: boolean;
};

export const useRecoveryPhraseProtected = (
  _options?: IUseRecoveryPhraseProtectedOptions,
) => {};
