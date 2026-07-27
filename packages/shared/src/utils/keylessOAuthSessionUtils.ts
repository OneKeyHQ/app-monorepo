import { EOneKeyErrorClassNames } from '../errors/types/errorTypes';
import errorUtils from '../errors/utils/errorUtils';

import { isTransientNetworkLikeError } from './transientNetworkErrorUtils';

/**
 * Whether a failed OneKey ID OAuth operation definitively invalidates the
 * shared Keyless OAuth session. Transient failures preserve the retryable
 * session, while slot replacement preserves the different account's winning
 * session.
 *
 * The legacy-bind state-changed rejection is exempt for the same reason as
 * slot replacement: it means a concurrent flow changed the OneKey ID login
 * out from under the bind, so the shared slot may hold or back that flow's
 * valid session — tearing it down would break the winning login too.
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
    }) &&
    !errorUtils.isErrorByClassName({
      error,
      className:
        EOneKeyErrorClassNames.OneKeyErrorOneKeyIdLegacyBindStateChanged,
    })
  );
}
