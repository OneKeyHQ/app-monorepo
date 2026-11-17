/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { EOneKeyIdLoginWithLocalKeylessPrepareStatus } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';

import { useOneKeyIdLocalKeylessOAuth } from './useOneKeyIdLocalKeylessOAuth';

type ILocalKeylessContinuationResult =
  | {
      status: 'ready';
      accessToken: string;
      provider: EOAuthSocialLoginProvider;
      walletId: string;
    }
  | {
      status: 'retryable' | 'needOAuthLogin';
      provider: EOAuthSocialLoginProvider;
      walletId: string;
    };

const mockContinueOneKeyIdLoginWithLocalKeyless = jest.fn<
  Promise<ILocalKeylessContinuationResult>,
  []
>();
const mockValidateTokenMatchesKeylessWallet = jest.fn<
  Promise<{ isValid: boolean }>,
  [{ token: string }]
>(async () => ({
  isValid: true,
}));
const mockSignInWithSocialLogin = jest.fn(async () => ({
  session: {
    accessToken: 'fresh-oauth-access-token',
    refreshToken: 'fresh-oauth-refresh-token',
  },
}));
const mockPersistKeylessOAuthSession = jest.fn(async () => ({
  rollbackHandle: undefined,
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'message' }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceKeylessWallet: {
      continueOneKeyIdLoginWithLocalKeyless: () =>
        mockContinueOneKeyIdLoginWithLocalKeyless(),
      validateTokenMatchesKeylessWallet: (params: { token: string }) =>
        mockValidateTokenMatchesKeylessWallet(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    signInWithSocialLogin: mockSignInWithSocialLogin,
    persistKeylessOAuthSession: mockPersistKeylessOAuthSession,
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/components/KeylessWallet/AccountMismatchDialog',
  () => ({ showKeylessWalletAccountMismatchError: jest.fn() }),
);

jest.mock('./oneKeyIdLoginToastUtils', () => ({
  logOneKeyIdLoginFailureReason: jest.fn(),
  throwLocalizedOneKeyIdLoginError: jest.fn(),
}));

describe('useOneKeyIdLocalKeylessOAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not start a fresh OAuth login when local Keyless continuation fails transiently', async () => {
    const transientError = new Error('temporary storage failure');
    mockContinueOneKeyIdLoginWithLocalKeyless.mockRejectedValueOnce(
      transientError,
    );
    const { result } = renderHook(() =>
      useOneKeyIdLocalKeylessOAuth({
        localKeylessLoginPrepareResult: {
          status:
            EOneKeyIdLoginWithLocalKeylessPrepareStatus.ContinueWithKeyless,
          provider: EOAuthSocialLoginProvider.Google,
          walletId: 'keyless-wallet-1',
        },
      }),
    );

    await expect(
      result.current.getOAuthAccessToken({
        provider: EOAuthSocialLoginProvider.Google,
        missingTokenMessage: 'Please retry.',
      }),
    ).rejects.toBe(transientError);
    expect(mockSignInWithSocialLogin).not.toHaveBeenCalled();
    expect(mockPersistKeylessOAuthSession).not.toHaveBeenCalled();
  });
});
