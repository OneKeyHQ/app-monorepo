import { EOneKeyErrorClassNames } from '../errors/types/errorTypes';
import errorUtils from '../errors/utils/errorUtils';

import { isTransientNetworkLikeError } from './transientNetworkErrorUtils';

/**
 * Whether a failed OneKey ID OAuth operation definitively invalidates the
 * shared Keyless OAuth session. Transient failures preserve the retryable
 * session, while slot replacement preserves the different account's winning
 * session.
 *
 * Note the legacy-bind state-changed rejection is deliberately NOT exempt.
 * It is a definitive abort, and the caller's rollback is ownership-guarded
 * (rollbackProvisionalKeylessOAuthSession refuses once the slot backs a
 * committed KeylessOAuth login, and otherwise deletes only the exact
 * revision + sessionCommitId + sessionTokenSub it reserved), so a concurrent
 * flow's winning session is already safe. Exempting it would instead leak
 * this flow's own provisional session in the common abort case.
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
