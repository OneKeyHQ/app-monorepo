import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

// Errors cross the background/UI bridge as plain objects on native and extension.
export function shouldCloseReplaceTxOnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const { className } = error as { className?: string };
  return (
    className === EOneKeyErrorClassNames.ReplaceTxNonceConsumed ||
    className === EOneKeyErrorClassNames.InfiniReplacementUnavailable ||
    className === EOneKeyErrorClassNames.InfiniReplacementExpired
  );
}
