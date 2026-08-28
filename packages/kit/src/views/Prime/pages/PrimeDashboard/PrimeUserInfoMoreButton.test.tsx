/** @jest-environment jsdom */
/* cspell:ignore Infini */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { PrimeTestIDs } from '../../testIDs';

import { PrimeUserInfoMoreButton } from './PrimeUserInfoMoreButton';

const mockActionListClose = jest.fn();
const mockShowPrimeRedemptionDialog = jest.fn();
const mockPrimeRedemptionEntryClick = jest.fn();
const mockPrimeManageSubscriptionClick = jest.fn();
const mockNavigationPush = jest.fn();
const mockOpenUrlExternal = jest.fn();
const mockApiFetchPrimeUserInfo = jest.fn<
  Promise<{
    userInfo: {
      primeSubscription?: {
        isActive: boolean;
        subscriptions?: { channel?: string; managementUrl?: string }[];
      };
    };
  }>,
  [{ forceRefresh: boolean }]
>();
let mockPromiseResultMethod: (() => Promise<unknown>) | undefined;
let mockManagementResolution:
  | {
      onekeyUserId: string;
      subscriptionSourceKey: string;
      target: { type: 'infini' } | { type: 'external'; url: string };
    }
  | undefined;
let mockIsManagementTargetLoading = false;
const mockUser: {
  displayEmail: string;
  onekeyUserId: string;
  primeSubscription?: {
    isActive: boolean;
    expiresAt?: number;
    subscriptions?: { channel?: string; managementUrl?: string }[];
  };
  subscriptionManageUrl?: string;
} = {
  displayEmail: 'user@example.com',
  onekeyUserId: 'user-a',
};

const getMockSubscriptionSourceKey = () =>
  JSON.stringify([
    mockUser.primeSubscription?.expiresAt,
    mockUser.primeSubscription?.subscriptions,
    mockUser.subscriptionManageUrl,
  ]);

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
    },
    IconButton: () => null,
    SizableText: Container,
    Stack: Container,
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
  default: () => ({ push: mockNavigationPush }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (method: () => Promise<unknown>) => {
    mockPromiseResultMethod = method;
    return {
      result: mockManagementResolution,
      isLoading: mockIsManagementTargetLoading,
    };
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      apiFetchPrimeUserInfo: (params: { forceRefresh: boolean }) =>
        mockApiFetchPrimeUserInfo(params),
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false }],
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

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: {
    openUrlExternal: (...args: unknown[]) => {
      mockOpenUrlExternal(...args);
    },
  },
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
    mockManagementResolution = undefined;
    mockIsManagementTargetLoading = false;
    mockPromiseResultMethod = undefined;
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
    mockUser.primeSubscription = {
      isActive: true,
      subscriptions: [{ channel: 'redemption' }],
    };
    mockUser.subscriptionManageUrl = undefined;
    mockManagementResolution = undefined;
    mockIsManagementTargetLoading = false;
    mockPromiseResultMethod = undefined;
  });

  it('hides the entry when only a stale aggregate URL exists', () => {
    mockUser.subscriptionManageUrl = 'https://example.com/stale-manage';
    render(<PrimeUserInfoMoreButton />);

    expect(
      screen.queryByTestId(PrimeTestIDs.manageSubscriptionMenuItem),
    ).toBeNull();
  });

  it('hides the entry while the current target is resolving', () => {
    mockIsManagementTargetLoading = true;
    render(<PrimeUserInfoMoreButton />);

    expect(
      screen.queryByTestId(PrimeTestIDs.manageSubscriptionMenuItem),
    ).toBeNull();
  });

  it('force refreshes the current server record for an unresolved target', async () => {
    mockApiFetchPrimeUserInfo.mockResolvedValue({
      userInfo: {
        primeSubscription: {
          isActive: true,
          subscriptions: [{ channel: 'infini' }],
        },
      },
    });
    render(<PrimeUserInfoMoreButton />);

    await expect(mockPromiseResultMethod?.()).resolves.toEqual({
      onekeyUserId: 'user-a',
      subscriptionSourceKey: getMockSubscriptionSourceKey(),
      target: { type: 'infini' },
    });
    expect(mockApiFetchPrimeUserInfo).toHaveBeenCalledWith({
      forceRefresh: true,
    });
  });

  it('opens a resolved current management URL', () => {
    mockUser.primeSubscription = {
      isActive: true,
      subscriptions: [
        {
          channel: 'app-store',
          managementUrl: 'https://example.com/manage',
        },
      ],
    };
    render(<PrimeUserInfoMoreButton />);

    fireEvent.click(
      screen.getByTestId(PrimeTestIDs.manageSubscriptionMenuItem),
    );

    expect(mockOpenUrlExternal).toHaveBeenCalledWith(
      'https://example.com/manage',
    );
    expect(mockPrimeManageSubscriptionClick).toHaveBeenCalledWith({
      target: 'externalUrl',
    });
  });

  it('opens in-app management for a resolved Infini channel', () => {
    mockUser.primeSubscription = {
      isActive: true,
      subscriptions: [{ channel: 'infini' }],
    };
    render(<PrimeUserInfoMoreButton />);

    fireEvent.click(
      screen.getByTestId(PrimeTestIDs.manageSubscriptionMenuItem),
    );

    expect(mockNavigationPush).toHaveBeenCalled();
    expect(mockPrimeManageSubscriptionClick).toHaveBeenCalledWith({
      target: 'infiniPage',
    });
  });

  it('opens a refreshed management target for the same user and source', () => {
    mockManagementResolution = {
      onekeyUserId: 'user-a',
      subscriptionSourceKey: getMockSubscriptionSourceKey(),
      target: {
        type: 'external',
        url: 'https://example.com/fresh-manage',
      },
    };
    render(<PrimeUserInfoMoreButton />);

    fireEvent.click(
      screen.getByTestId(PrimeTestIDs.manageSubscriptionMenuItem),
    );

    expect(mockOpenUrlExternal).toHaveBeenCalledWith(
      'https://example.com/fresh-manage',
    );
  });

  it.each([
    {
      name: 'another user',
      onekeyUserId: 'user-b',
      subscriptionSourceKey: getMockSubscriptionSourceKey(),
    },
    {
      name: 'another subscription source',
      onekeyUserId: 'user-a',
      subscriptionSourceKey: 'stale-subscription-source',
    },
  ])('hides a stale resolution from $name', (resolutionSource) => {
    mockManagementResolution = {
      onekeyUserId: resolutionSource.onekeyUserId,
      subscriptionSourceKey: resolutionSource.subscriptionSourceKey,
      target: {
        type: 'external',
        url: 'https://example.com/stale-manage',
      },
    };
    render(<PrimeUserInfoMoreButton />);

    expect(
      screen.queryByTestId(PrimeTestIDs.manageSubscriptionMenuItem),
    ).toBeNull();
  });
});
