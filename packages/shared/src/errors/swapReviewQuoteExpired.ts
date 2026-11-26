import { OneKeyError } from './errors/baseErrors';
import { OneKeyLocalError } from './errors/localError';
import { toPlainErrorObject } from './utils/errorUtils';

const SWAP_REVIEW_QUOTE_EXPIRED_BEFORE_BROADCAST =
  'swapReviewQuoteExpiredBeforeBroadcast';
const locallyCreatedErrors = new WeakSet<object>();
const locallyCreatedSigningErrors = new WeakSet<object>();

export function createSwapReviewQuoteExpiredError(
  definitelyNotSubmitted: boolean,
) {
  const error = new OneKeyLocalError({
    message: 'Swap review quote expired before broadcast',
    autoToast: false,
    data: {
      [SWAP_REVIEW_QUOTE_EXPIRED_BEFORE_BROADCAST]: true,
      definitelyNotSubmitted,
    },
  });
  locallyCreatedErrors.add(error);
  return error;
}

export function isLocallyCreatedSwapReviewQuoteExpiredError(error: unknown) {
  return Boolean(
    error && typeof error === 'object' && locallyCreatedErrors.has(error),
  );
}

// ServiceSend is the trust boundary: remote errors must never be able to
// impersonate the local "not submitted" result, including in one runtime.
export function sanitizeSwapReviewQuoteExpiredError(error: unknown) {
  if (
    (isSwapReviewQuoteExpiredBeforeBroadcast(error) &&
      !isLocallyCreatedSwapReviewQuoteExpiredError(error)) ||
    (isSwapReviewSigningFailureBeforeBroadcast(error) &&
      !isLocallyCreatedSwapReviewSigningFailure(error))
  ) {
    return new OneKeyLocalError('Transaction submission failed');
  }
  return error;
}

export function createSwapReviewSigningFailure(error: unknown) {
  const original = toPlainErrorObject(error);
  const result = Object.assign(
    new OneKeyError({
      ...original,
      code:
        typeof original.code === 'number' && Number.isInteger(original.code)
          ? original.code
          : undefined,
      message: typeof error === 'string' ? error : original.message,
      data: { swapReviewSigningFailedBeforeBroadcast: true },
    }),
    {
      $isHardwareError: original.$isHardwareError,
      reconnect: original.reconnect,
    },
  );
  locallyCreatedSigningErrors.add(result);
  return result;
}

export function isLocallyCreatedSwapReviewSigningFailure(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    locallyCreatedSigningErrors.has(error),
  );
}

export function isSwapReviewSigningFailureBeforeBroadcast(error: unknown) {
  if (!error || typeof error !== 'object' || !('data' in error)) return false;
  const { data } = error;
  return Boolean(
    data &&
    typeof data === 'object' &&
    'swapReviewSigningFailedBeforeBroadcast' in data &&
    data.swapReviewSigningFailedBeforeBroadcast === true,
  );
}

export function isSwapReviewQuoteExpiredWithoutSubmission(error: unknown) {
  if (!isSwapReviewQuoteExpiredBeforeBroadcast(error)) return false;
  if (!error || typeof error !== 'object' || !('data' in error)) return false;
  const { data } = error;
  return Boolean(
    data &&
    typeof data === 'object' &&
    'definitelyNotSubmitted' in data &&
    data.definitelyNotSubmitted === true,
  );
}

export function isSwapReviewQuoteExpiredBeforeBroadcast(error: unknown) {
  if (!error || typeof error !== 'object' || !('data' in error)) return false;
  const { data } = error;
  return Boolean(
    data &&
    typeof data === 'object' &&
    SWAP_REVIEW_QUOTE_EXPIRED_BEFORE_BROADCAST in data &&
    data[SWAP_REVIEW_QUOTE_EXPIRED_BEFORE_BROADCAST] === true,
  );
}
