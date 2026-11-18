import { OneKeyLocalError } from './errors/localError';

const SWAP_REVIEW_QUOTE_EXPIRED_BEFORE_BROADCAST =
  'swapReviewQuoteExpiredBeforeBroadcast';
const locallyCreatedErrors = new WeakSet<object>();

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
    isSwapReviewQuoteExpiredBeforeBroadcast(error) &&
    !isLocallyCreatedSwapReviewQuoteExpiredError(error)
  ) {
    return new OneKeyLocalError('Transaction submission failed');
  }
  return error;
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
