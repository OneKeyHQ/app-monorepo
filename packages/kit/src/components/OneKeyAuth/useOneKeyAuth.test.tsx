/** @jest-environment jsdom */

import { isValidElement } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import {
  OneKeyLocalError,
  PrimeLoginDialogCancelError,
} from '@onekeyhq/shared/src/errors';
import {
  EOneKeyIdLoginWithLocalKeylessPrepareStatus,
  type IOneKeyIdLoginWithLocalKeylessPrepareResult,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';

import { useOneKeyAuth } from './useOneKeyAuth';

const mockIsLoggedIn = jest.fn<Promise<boolean>, []>();
const mockPrepareOneKeyIdLoginWithLocalKeyless = jest.fn<
  Promise<IOneKeyIdLoginWithLocalKeylessPrepareResult>,
  []
>();
const mockDialogCloses: jest.Mock[] = [];

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);

  return {
    Dialog: {
      show: jest.fn(),
    },
    Spinner: () => null,
    Stack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceKeylessWallet: {
      prepareOneKeyIdLoginWithLocalKeyless: () =>
        mockPrepareOneKeyIdLoginWithLocalKeyless(),
    },
    servicePrime: {
      isLoggedIn: () => mockIsLoggedIn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/LazyLoadPage', () => ({
  LazyLoadPage: () =>
    function MockLazyPage() {
      return null;
    },
}));

jest.mock(
  '@onekeyhq/kit/src/components/OneKeyAuth/supabase/useSupabaseAuth',
  () => ({
    useSupabaseAuth: () => ({
      getAccessToken: jest.fn(),
      getSupabaseClient: jest.fn(),
      isLoggedIn: false,
      isReady: true,
      persistKeylessOAuthSession: jest.fn(),
      signInWithOtp: jest.fn(),
      signInWithSocialLogin: jest.fn(),
      supabaseUser: undefined,
      verifyOtp: jest.fn(),
    }),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Prime/components/oneKeyIdLoginToastUtils',
  () => ({
    getSanitizedAuthErrorText: jest.fn(() => ''),
    logOneKeyIdLoginFailureReason: jest.fn(),
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimePersistAtom: () => [undefined],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    wait: jest.fn(async () => undefined),
  },
}));

jest.mock('../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pushModal: jest.fn(),
  }),
}));

jest.mock('./extOneKeyIdAuthExpandTab', () => ({
  redirectOneKeyIdAuthToExtExpandTab: jest.fn(),
  shouldRunOneKeyIdAuthInExtExpandTab: () => false,
}));

type ILoginDialogContentProps = {
  initialShowKeylessLogoutAction?: boolean;
  onCancel: () => void;
  onComplete: () => Promise<void>;
  onLoginSuccess: () => Promise<void>;
  onReopenAfterOAuthFailure: (options?: {
    showKeylessLogoutAction?: boolean;
  }) => void;
};

function getDialogContentProps(index: number): ILoginDialogContentProps {
  const options = jest.mocked(Dialog.show).mock.calls[index]?.[0];
  if (!isValidElement<ILoginDialogContentProps>(options?.renderContent)) {
    throw new OneKeyLocalError(`Dialog content ${index} was not rendered`);
  }
  return options.renderContent.props;
}

describe('useOneKeyAuth login dialog lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDialogCloses.length = 0;
    mockIsLoggedIn.mockResolvedValue(false);
    mockPrepareOneKeyIdLoginWithLocalKeyless.mockResolvedValue({
      status: EOneKeyIdLoginWithLocalKeylessPrepareStatus.NoLocalKeyless,
    });
    jest.mocked(Dialog.show).mockImplementation(() => {
      const close = jest.fn(async () => undefined);
      mockDialogCloses.push(close);
      return {
        close,
        getForm: () => undefined,
        isExist: () => true,
      };
    });
  });

  test('reopens after OAuth failure and resolves through the new dialog', async () => {
    const { result } = renderHook(() => useOneKeyAuth());
    const onResolved = jest.fn();
    const onRejected = jest.fn();

    const loginPromise = result.current.loginOneKeyId();
    void loginPromise.then(onResolved, onRejected);

    await waitFor(() => {
      expect(Dialog.show).toHaveBeenCalledTimes(1);
    });
    const firstDialog = getDialogContentProps(0);

    await act(async () => {
      await firstDialog.onComplete();
    });
    expect(mockDialogCloses[0]).toHaveBeenCalledTimes(1);

    act(() => {
      firstDialog.onReopenAfterOAuthFailure({
        showKeylessLogoutAction: true,
      });
    });

    await waitFor(() => {
      expect(Dialog.show).toHaveBeenCalledTimes(2);
    });
    expect(onResolved).not.toHaveBeenCalled();
    expect(onRejected).not.toHaveBeenCalled();

    const reopenedDialog = getDialogContentProps(1);
    expect(reopenedDialog.initialShowKeylessLogoutAction).toBe(true);

    await act(async () => {
      await reopenedDialog.onLoginSuccess();
    });
    await expect(loginPromise).resolves.toBeUndefined();
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onRejected).not.toHaveBeenCalled();
  });

  test('rejects as cancel only when the reopened dialog is cancelled', async () => {
    const { result } = renderHook(() => useOneKeyAuth());
    const loginPromise = result.current.loginOneKeyId();

    await waitFor(() => {
      expect(Dialog.show).toHaveBeenCalledTimes(1);
    });
    const firstDialog = getDialogContentProps(0);

    await act(async () => {
      await firstDialog.onComplete();
    });
    act(() => {
      firstDialog.onReopenAfterOAuthFailure();
    });

    await waitFor(() => {
      expect(Dialog.show).toHaveBeenCalledTimes(2);
    });
    const reopenedDialog = getDialogContentProps(1);
    act(() => {
      reopenedDialog.onCancel();
    });

    await expect(loginPromise).rejects.toBeInstanceOf(
      PrimeLoginDialogCancelError,
    );
  });
});
