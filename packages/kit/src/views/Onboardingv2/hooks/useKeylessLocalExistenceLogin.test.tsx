/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';

import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import { useOneKeyAuth } from '../../../components/OneKeyAuth/useOneKeyAuth';

import { useKeylessLocalExistenceLogin } from './useKeylessLocalExistenceLogin';

const mockCheckKeylessWalletLocalExistence = jest.fn();
const mockLogout = jest.fn();
const mockOnResetModeChange = jest.fn();
const mockPersistKeylessOAuthSession = jest.fn();
const mockSignInWithSocialLogin = jest.fn();
const mockApiResetKeylessBackendShare = jest.fn();
const mockGetIncomingKeylessOAuthSessionConflictInfo = jest.fn();
const mockValidateTokenMatchesKeylessWallet = jest.fn();
const mockToastSuccess = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: () => 'translated message',
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    loading: jest.fn(),
  },
  Toast: {
    success: (params: { title: string }) => {
      mockToastSuccess(params);
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    account: {
      wallet: {
        onboard: jest.fn(),
      },
    },
  },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceKeylessWallet: {
      apiResetKeylessBackendShare: async (params: { token: string }) => {
        mockApiResetKeylessBackendShare(params);
        return { ok: true };
      },
      getIncomingKeylessOAuthSessionConflictInfo: async () => {
        mockGetIncomingKeylessOAuthSessionConflictInfo();
        return { hasConflict: false };
      },
      validateTokenMatchesKeylessWallet: async () => {
        mockValidateTokenMatchesKeylessWallet();
        return { isValid: true };
      },
    },
  },
}));

jest.mock('../../../components/KeylessWallet/useKeylessWallet', () => ({
  useKeylessWallet: jest.fn(),
}));

jest.mock('../../../components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: jest.fn(),
}));

describe('useKeylessLocalExistenceLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useKeylessWallet).mockReturnValue({
      checkKeylessWalletLocalExistence: mockCheckKeylessWalletLocalExistence,
      enableKeylessWalletLoading: false,
    } as unknown as ReturnType<typeof useKeylessWallet>);
    jest.mocked(useOneKeyAuth).mockReturnValue({
      logout: mockLogout,
      persistKeylessOAuthSession: mockPersistKeylessOAuthSession,
      signInWithSocialLogin: mockSignInWithSocialLogin,
    } as unknown as ReturnType<typeof useOneKeyAuth>);
    mockSignInWithSocialLogin.mockResolvedValue({
      success: true,
      session: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    });
  });

  it('resets the cloud keyless wallet without requiring a local keyless session', async () => {
    const { result } = renderHook(() =>
      useKeylessLocalExistenceLogin({
        isResetMode: true,
        onResetModeChange: mockOnResetModeChange,
      }),
    );

    await act(async () => {
      await result.current.handleGoogleLogin();
    });

    expect(mockSignInWithSocialLogin).toHaveBeenCalledWith(
      EOAuthSocialLoginProvider.Google,
    );
    expect(mockValidateTokenMatchesKeylessWallet).not.toHaveBeenCalled();
    expect(
      mockGetIncomingKeylessOAuthSessionConflictInfo,
    ).not.toHaveBeenCalled();
    expect(mockPersistKeylessOAuthSession).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockApiResetKeylessBackendShare).toHaveBeenCalledWith({
      token: 'access-token',
    });
    expect(mockToastSuccess).toHaveBeenCalledWith({ title: 'Reset Success' });
    expect(mockOnResetModeChange).toHaveBeenCalledWith(false);
  });

  it('keeps the regular create-or-restore flow unchanged', async () => {
    const { result } = renderHook(() =>
      useKeylessLocalExistenceLogin({ isResetMode: false }),
    );

    await act(async () => {
      await result.current.handleAppleLogin();
    });

    expect(mockCheckKeylessWalletLocalExistence).toHaveBeenCalledWith({
      signInProvider: EOAuthSocialLoginProvider.Apple,
    });
    expect(mockApiResetKeylessBackendShare).not.toHaveBeenCalled();
    expect(mockSignInWithSocialLogin).not.toHaveBeenCalled();
    expect(mockValidateTokenMatchesKeylessWallet).not.toHaveBeenCalled();
    expect(mockPersistKeylessOAuthSession).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
