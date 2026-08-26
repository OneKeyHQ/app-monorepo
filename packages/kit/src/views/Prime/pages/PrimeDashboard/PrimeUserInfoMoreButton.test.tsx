/** @jest-environment jsdom */
/* cspell:ignore Infini */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { PrimeTestIDs } from '../../testIDs';

import { PrimeUserInfoMoreButton } from './PrimeUserInfoMoreButton';

const mockActionListClose = jest.fn();
const mockShowPrimeRedemptionDialog = jest.fn();
const mockPrimeRedemptionEntryClick = jest.fn();
const mockPrimeManageSubscriptionClick = jest.fn();
const mockResolvePrimeSubscriptionManagementTarget = jest.fn();
const mockUser: {
  displayEmail: string;
  onekeyUserId: string;
  primeSubscription?: { isActive: boolean };
  subscriptionManageUrl?: string;
} = {
  displayEmail: 'user@example.com',
  onekeyUserId: 'user-a',
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  function Container({ children }: { children?: ReactNode }) {
    return React.createElement('div', null, children);
  }
  const ActionList = Object.assign(
    ({
      renderItems,
    }: {
      renderItems: (args: {
        handleActionListClose: () => void;
        handleActionListOpen: () => void;
      }) => ReactNode;
    }) =>
      React.createElement(
        'div',
        null,
        renderItems({
          handleActionListClose: mockActionListClose,
          handleActionListOpen: jest.fn(),
        }),
      ),
    {
      Item: ({
        label,
        onPress,
        testID,
      }: {
        label: string;
        onPress?: (close: () => void) => void;
        testID?: string;
      }) =>
        React.createElement(
          'button',
          {
            'data-testid': testID,
            onClick: () => onPress?.(mockActionListClose),
            type: 'button',
          },
          label,
        ),
    },
  );
  return {
    ActionList,
    Dialog: {
      debugMessage: jest.fn(),
      loading: jest.fn(() => ({ close: jest.fn() })),
    },
    IconButton: () => null,
    SizableText: Container,
    Stack: Container,
    Toast: { error: jest.fn() },
    XStack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/components/MultipleClickStack', () => ({
  MultipleClickStack: ({ children }: { children?: ReactNode }) => children,
}));

jest.mock(
  '@onekeyhq/kit/src/components/OneKeyAuth/useConfirmOneKeyIdLogout',
  () => ({ useConfirmOneKeyIdLogout: () => jest.fn() }),
);

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({ user: mockUser }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      apiFetchPrimeUserInfo: jest.fn(),
      apiGetInfiniSubscription: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false }],
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    showToastOfError: jest.fn(),
    toastIfError: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroidGooglePlay: false,
    isNativeIOS: false,
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeRedemptionEntryClick: (...args: unknown[]) => {
          mockPrimeRedemptionEntryClick(...args);
        },
        primeManageSubscriptionClick: (...args: unknown[]) => {
          mockPrimeManageSubscriptionClick(...args);
        },
      },
    },
  },
}));

jest.mock('./primeSubscriptionManagementUtils', () => ({
  getPrimeSubscriptionManagementTarget: () => ({
    type: 'unavailable',
    reason: 'missing-channel-and-management-url',
  }),
  resolvePrimeSubscriptionManagementTarget: (
    ...args: unknown[]
  ): Promise<unknown> =>
    mockResolvePrimeSubscriptionManagementTarget(...args) as Promise<unknown>,
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: { openUrlExternal: jest.fn() },
}));

jest.mock('../../components/PrimePurchaseDialog/PrimePurchaseDialog', () => ({
  usePrimePurchaseCallback: () => ({ purchase: jest.fn() }),
}));

jest.mock('../../hooks/usePrimePayment', () => ({
  usePrimePayment: () => ({ getCustomerInfo: jest.fn() }),
}));

jest.mock('./PrimeRedemptionDialog', () => ({
  showPrimeRedemptionDialog: (...args: unknown[]) => {
    mockShowPrimeRedemptionDialog(...args);
  },
}));

describe('PrimeUserInfoMoreButton redemption entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.primeSubscription = undefined;
    mockUser.subscriptionManageUrl = undefined;
  });

  it.each([false, true])(
    'shows the redemption entry when Prime active is %s',
    (isPrimeActive) => {
      mockUser.primeSubscription = { isActive: isPrimeActive };
      render(<PrimeUserInfoMoreButton />);

      fireEvent.click(screen.getByTestId(PrimeTestIDs.redemptionMenuItem));

      expect(mockShowPrimeRedemptionDialog).toHaveBeenCalledWith({
        expectedOneKeyUserId: 'user-a',
        isPrimeActiveBeforeRedeem: isPrimeActive,
      });
      expect(mockPrimeRedemptionEntryClick).toHaveBeenCalledWith({
        isPrimeActiveBeforeRedeem: isPrimeActive,
      });
      expect(mockActionListClose).toHaveBeenCalled();
    },
  );
});

describe('PrimeUserInfoMoreButton manage subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.primeSubscription = { isActive: true };
    mockUser.subscriptionManageUrl = undefined;
    mockResolvePrimeSubscriptionManagementTarget.mockRejectedValue(
      new Error('subscription lookup failed'),
    );
  });

  it('records an unresolved click when destination resolution throws', async () => {
    render(<PrimeUserInfoMoreButton />);

    fireEvent.click(
      screen.getByTestId(PrimeTestIDs.manageSubscriptionMenuItem),
    );

    await waitFor(() =>
      expect(mockPrimeManageSubscriptionClick).toHaveBeenCalledWith({
        target: 'unresolved',
      }),
    );
  });
});
