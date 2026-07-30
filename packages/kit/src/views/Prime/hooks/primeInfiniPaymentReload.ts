/* cspell:ignore Infini */
export type IPrimeInfiniPaymentReloadRequest = {
  minimumLoadAttempt: number;
  previousBindingId: string | undefined;
};

export function resolvePrimeInfiniPaymentReloadCommit({
  request,
  committedLoadAttempt,
  committedBindingId,
}: {
  request: IPrimeInfiniPaymentReloadRequest;
  committedLoadAttempt: number;
  committedBindingId: string | undefined;
}): 'wait' | 'settled' | 'remount' {
  if (committedLoadAttempt < request.minimumLoadAttempt) {
    return 'wait';
  }
  if (committedBindingId !== request.previousBindingId) {
    return 'settled';
  }
  return 'remount';
}
