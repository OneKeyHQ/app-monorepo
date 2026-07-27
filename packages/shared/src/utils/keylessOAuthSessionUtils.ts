import { EOneKeyErrorClassNames } from '../errors/types/errorTypes';
import errorUtils from '../errors/utils/errorUtils';

import { isTransientNetworkLikeError } from './transientNetworkErrorUtils';

/**
 * Whether a failed OneKey ID OAuth operation definitively invalidates the
 * shared Keyless OAuth session. Transient failures preserve the retryable
 * session, while slot replacement preserves the different account's winning
 * session.
 */
export function shouldClearKeylessOAuthSessionAfterError(
  error: unknown,
): boolean {
  return (
    !isTransientNetworkLikeError(error) &&
    !errorUtils.isErrorByClassName({
      error,
      className:
        EOneKeyErrorClassNames.OneKeyErrorOneKeyIdKeylessSessionSlotReplaced,
    })
  );
}
