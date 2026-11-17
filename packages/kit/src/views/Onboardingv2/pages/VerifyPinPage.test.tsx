/** @jest-environment jsdom */

import { useRoute } from '@react-navigation/core';
import { render, waitFor } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import {
  EOnboardingPagesV2,
  EOnboardingV2OneKeyIDLoginMode,
} from '@onekeyhq/shared/src/routes';

import {
  useKeylessWallet,
  useVerifyKeylessPinChecking,
} from '../../../components/KeylessWallet/useKeylessWallet';
import useAppNavigation from '../../../hooks/useAppNavigation';

import VerifyPinPage from './VerifyPinPage';

jest.mock('@react-navigation/core', () => ({
  useRoute: jest.fn(),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
  },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceKeylessWallet: {
      apiGetCachedKeylessRateLimitStatus: jest.fn(),
    },
    servicePassword: {
      clearCachedPassword: jest.fn(),
      promptPasswordVerify: jest.fn(),
    },
  },
}));

jest.mock('../../../components/AccountSelector/AccountSelectorProvider', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    AccountSelectorProviderMirror: ({
      children,
    }: {
      children?: import('react').ReactNode;
    }) => React.createElement(React.Fragment, null, children),
  };
});

jest.mock('../../../components/KeylessWallet/useKeylessWallet', () => ({
  useKeylessWallet: jest.fn(),
  useVerifyKeylessPinChecking: jest.fn(),
}));

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({
    formatDuration: jest.fn(() => 'duration'),
  }),
}));

jest.mock('../components/PinInputLayout', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    PinInputLayout: React.forwardRef(() =>
      React.createElement('div', { 'data-testid': 'pin-input-layout' }),
    ),
  };
});

describe('VerifyPinPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('routes an already exhausted initial PIN state directly to the reset guide', async () => {
    const navigation = {
      push: jest.fn(),
    };
    const checkKeylessOnboardingRateLimitStatus = jest.fn(async () => ({
      guessesRemaining: 0,
      isRateLimited: true,
      retryAfterSeconds: 30,
    }));
    jest.mocked(useRoute).mockReturnValue({
      params: {
        mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
      },
    } as ReturnType<typeof useRoute>);
    jest
      .mocked(useAppNavigation)
      .mockReturnValue(
        navigation as unknown as ReturnType<typeof useAppNavigation>,
      );
    jest.mocked(useKeylessWallet).mockReturnValue({
      checkKeylessOnboardingRateLimitStatus,
      getKeylessOnboardingToken: jest.fn(),
      verifyKeylessOnboardingPin: jest.fn(),
    } as unknown as ReturnType<typeof useKeylessWallet>);
    jest.mocked(useVerifyKeylessPinChecking).mockReturnValue({
      cancelVerifyPin: jest.fn(),
    } as unknown as ReturnType<typeof useVerifyKeylessPinChecking>);

    render(<VerifyPinPage />);

    await waitFor(() => {
      expect(checkKeylessOnboardingRateLimitStatus).toHaveBeenCalledWith({
        mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
      });
      expect(Toast.error).toHaveBeenCalledWith({
        title: 'pin_attempts_exhausted',
      });
      expect(navigation.push).toHaveBeenCalledWith(
        EOnboardingPagesV2.ResetPinGuide,
      );
    });
  });
});
