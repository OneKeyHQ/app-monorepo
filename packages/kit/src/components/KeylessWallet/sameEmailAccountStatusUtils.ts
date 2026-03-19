import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { RequestLimitExceededError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';

export type IKeylessSameEmailAccountStatus = {
  isSameEmailAccountAtOldVersion: boolean;
  retryProvider?: EOAuthSocialLoginProvider;
  currentProvider?: EOAuthSocialLoginProvider;
};

export function isKeylessSameEmailAutoRetryRateLimitError(
  error: unknown,
): boolean {
  const isRateLimitErrorByInstance = error instanceof RequestLimitExceededError;
  const isRateLimitErrorByClassName = errorUtils.isErrorByClassName({
    error,
    className: EOneKeyErrorClassNames.RequestLimitExceededError,
  });

  return isRateLimitErrorByInstance || isRateLimitErrorByClassName;
}

export function getPromotedSameEmailAccountStatusAfterAutoRetryRateLimit(
  status: IKeylessSameEmailAccountStatus,
): IKeylessSameEmailAccountStatus | undefined {
  const { isSameEmailAccountAtOldVersion, currentProvider, retryProvider } =
    status;

  if (
    !isSameEmailAccountAtOldVersion ||
    !currentProvider ||
    !retryProvider ||
    currentProvider === retryProvider
  ) {
    return undefined;
  }

  return {
    isSameEmailAccountAtOldVersion,
    currentProvider: retryProvider,
    retryProvider: currentProvider,
  };
}
