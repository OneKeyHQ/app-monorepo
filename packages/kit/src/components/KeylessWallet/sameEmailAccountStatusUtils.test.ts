import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { RequestLimitExceededError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

import {
  getPromotedSameEmailAccountStatusAfterAutoRetryRateLimit,
  isKeylessSameEmailAutoRetryRateLimitError,
} from './sameEmailAccountStatusUtils';

describe('sameEmailAccountStatusUtils', () => {
  it('detects request-limit errors from the automatic retry path', () => {
    expect(
      isKeylessSameEmailAutoRetryRateLimitError(
        new RequestLimitExceededError(),
      ),
    ).toBe(true);

    expect(
      isKeylessSameEmailAutoRetryRateLimitError({
        className: EOneKeyErrorClassNames.RequestLimitExceededError,
      }),
    ).toBe(true);
  });

  it('ignores non-request-limit errors', () => {
    expect(
      isKeylessSameEmailAutoRetryRateLimitError({
        message: 'IncorrectPinError',
      }),
    ).toBe(false);
  });

  it('promotes the retry provider only for old-version same-email accounts', () => {
    expect(
      getPromotedSameEmailAccountStatusAfterAutoRetryRateLimit({
        isSameEmailAccountAtOldVersion: true,
        currentProvider: EOAuthSocialLoginProvider.Google,
        retryProvider: EOAuthSocialLoginProvider.Apple,
      }),
    ).toEqual({
      isSameEmailAccountAtOldVersion: true,
      currentProvider: EOAuthSocialLoginProvider.Apple,
      retryProvider: EOAuthSocialLoginProvider.Google,
    });
  });

  it('does not promote when required providers are missing or unchanged', () => {
    expect(
      getPromotedSameEmailAccountStatusAfterAutoRetryRateLimit({
        isSameEmailAccountAtOldVersion: false,
        currentProvider: EOAuthSocialLoginProvider.Google,
        retryProvider: EOAuthSocialLoginProvider.Apple,
      }),
    ).toBeUndefined();

    expect(
      getPromotedSameEmailAccountStatusAfterAutoRetryRateLimit({
        isSameEmailAccountAtOldVersion: true,
        currentProvider: EOAuthSocialLoginProvider.Google,
      }),
    ).toBeUndefined();

    expect(
      getPromotedSameEmailAccountStatusAfterAutoRetryRateLimit({
        isSameEmailAccountAtOldVersion: true,
        currentProvider: EOAuthSocialLoginProvider.Google,
        retryProvider: EOAuthSocialLoginProvider.Google,
      }),
    ).toBeUndefined();
  });
});
