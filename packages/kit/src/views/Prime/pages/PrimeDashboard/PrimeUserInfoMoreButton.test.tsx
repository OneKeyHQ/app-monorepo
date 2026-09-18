/** @jest-environment jsdom */
/* cspell:ignore Infini */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PrimeTestIDs } from '../../testIDs';

import { getPrimeSubscriptionManagementSourceKey } from './primeSubscriptionManagementUtils';
import { PrimeUserInfoMoreButton } from './PrimeUserInfoMoreButton';

const mockActionListClose = jest.fn();
const mockShowPrimeRedemptionDialog = jest.fn();
const mockPrimeRedemptionEntryClick = jest.fn();
const mockPrimeManageSubscriptionClick = jest.fn();
const mockNavigationPush = jest.fn();
const mockOpenUrlExternal = jest.fn();
const mockToastMessage = jest.fn();
const mockApiFetchPrimeUserInfo = jest.fn<
  Promise<{
    userInfo: {
      primeSubscription?: {
        isActive: boolean;
        subscriptions?: {
          channel?: string;
          managementUrl?: string | null;
        }[];
      };
    };
  }>,
  [{ forceRefresh: boolean }]
>();
const mockGetCustomerInfo = jest.fn<
  Promise<{ managementURL?: string | null }>,
  []
>();
let mockPromiseResultMethod: (() => Promise<unknown>) | undefined;
let mockManagementResolution:
  | {
      onekeyUserId: string;
      subscriptionSourceKey: string;
      target:
        | { type: 'infini' }
        | { type: 'external'; url: string }
        | { type: 'unavailable' };
    }
  | undefined;
const mockUser: {
  displayEmail: string;
  onekeyUserId: string;
  primeSubscription?: {
    isActive: boolean;
    expiresAt?: number;
    subscriptions?: { channel?: string; managementUrl?: string | null }[];
  };
  subscriptionManageUrl?: string;
} = {
  displayEmail: 'user@example.com',
  onekeyUserId: 'user-a',
};

const getMockSubscriptionSourceKey = () =>
  getPrimeSubscriptionManagementSourceKey({
    primeSubscription: mockUser.primeSubscription,
  });

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
    Toast: {
      message: (...args: unknown[]) => {
        mockToastMessage(...args);
      },
    },
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

const mockPlatformEnv = platformEnv as {
  isNative: boolean;
  isNativeAndroidGooglePlay: boolean;
  isNativeIOS: boolean;
};

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
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
  usePrimePayment: () => ({ getCustomerInfo: () => mockGetCustomerInfo() }),
}));

jest.mock('./PrimeRedemptionDialog', () => ({
  showPrimeRedemptionDialog: (...args: unknown[]) => {
    mockShowPrimeRedemptionDialog(...args);
  },
}));

describe('PrimeUserInfoMoreButton redemption entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformEnv.isNative = false;
    mockPlatformEnv.isNativeIOS = false;
    mockUser.primeSubscription = undefined;
    mockUser.subscriptionManageUrl = undefined;
    mockManagementResolution = undefined;
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

  it('hides the redemption entry on native iOS', () => {
    mockPlatformEnv.isNative = true;
    mockPlatformEnv.isNativeIOS = true;
    mockUser.primeSubscription = { isActive: true };
    render(<PrimeUserInfoMoreButton />);

    expect(screen.queryByTestId(PrimeTestIDs.redemptionMenuItem)).toBeNull();
    expect(
      screen.getByTestId(PrimeTestIDs.manageSubscriptionMenuItem),
    ).toBeTruthy();
  });

  it('keeps the redemption entry on native Android', () => {
    mockPlatformEnv.isNative = true;
    mockPlatformEnv.isNativeIOS = false;
    render(<PrimeUserInfoMoreButton />);

    expect(screen.getByTestId(PrimeTestIDs.redemptionMenuItem)).toBeTruthy();
  });
});

describe('PrimeUserInfoMoreButton manage subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformEnv.isNative = false;
    mockPlatformEnv.isNativeIOS = false;
    mockUser.primeSubscription = {
      isActive: true,
      subscriptions: [],
    };
    mockUser.subscriptionManageUrl = undefined;
    mockManagementResolution = undefined;
    mockPromiseResultMethod = undefined;
    mockGetCustomerInfo.mockReset();
  });

  it('shows the entry and explains when Prime has no management URL', async () => {
    mockUser.primeSubscription = { isActive: true, subscriptions: [] };
    mockUser.subscriptionManageUrl = 'https://example.com/stale-manage';
    mockApiFetchPrimeUserInfo.mockResolvedValue({
      userInfo: {
        primeSubscription: { isActive: true, subscriptions: [] },
      },
    });
    render(<PrimeUserInfoMoreButton />);

    fireEvent.click(
      screen.getByTestId(PrimeTestIDs.manageSubscriptionMenuItem),
    );

    expect(mockOpenUrlExternal).not.toHaveBeenCalled();
    expect(mockToastMessage).toHaveBeenCalledWith({
      title: ETranslations.prime_subscription_management_unsupported__msg,
    });
    expect(mockPrimeManageSubscriptionClick).toHaveBeenCalledWith({
      target: 'unresolved',
    });

    await expect(mockPromiseResultMethod?.()).resolves.toEqual({
      onekeyUserId: 'user-a',
      subscriptionSourceKey: getMockSubscriptionSourceKey(),
      target: { type: 'unavailable' },
    });
    expect(mockApiFetchPrimeUserInfo).toHaveBeenCalledWith({
      forceRefresh: true,
    });
    expect(mockGetCustomerInfo).not.toHaveBeenCalled();
  });

  it('opens a locally available per-subscription management URL before refresh resolves', () => {
    mockUser.primeSubscription = {
      isActive: true,
      subscriptions: [
        {
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

  it('replaces a stale local target with the refreshed server record', async () => {
    mockUser.primeSubscription = {
      isActive: true,
      subscriptions: [
        {
          managementUrl: 'https://example.com/stale-manage',
        },
      ],
    };
    mockApiFetchPrimeUserInfo.mockResolvedValue({
      userInfo: {
        primeSubscription: {
          isActive: true,
          subscriptions: [],
        },
      },
    });
    const view = render(<PrimeUserInfoMoreButton />);

    const resolution = {
      onekeyUserId: 'user-a',
      subscriptionSourceKey: getMockSubscriptionSourceKey(),
      target: { type: 'unavailable' as const },
    };
    await expect(mockPromiseResultMethod?.()).resolves.toEqual(resolution);
    expect(mockApiFetchPrimeUserInfo).toHaveBeenCalledWith({
      forceRefresh: true,
    });
    mockManagementResolution = resolution;
    view.rerender(<PrimeUserInfoMoreButton />);
    fireEvent.click(
      screen.getByTestId(PrimeTestIDs.manageSubscriptionMenuItem),
    );
    expect(mockOpenUrlExternal).not.toHaveBeenCalled();
    expect(mockToastMessage).toHaveBeenCalledWith({
      title: ETranslations.prime_subscription_management_unsupported__msg,
    });
  });

  it('opens in-app Infini management and does not open its management URL', () => {
    mockUser.primeSubscription = {
      isActive: true,
      subscriptions: [
        {
          channel: 'infini',
          managementUrl: 'https://example.com/manage',
        },
      ],
    };
    render(<PrimeUserInfoMoreButton />);

    fireEvent.click(
      screen.getByTestId(PrimeTestIDs.manageSubscriptionMenuItem),
    );
    expect(mockOpenUrlExternal).not.toHaveBeenCalled();
    expect(mockNavigationPush).toHaveBeenCalledWith('PrimeInfiniSubscription');
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
  ])('ignores a stale resolution from $name', (resolutionSource) => {
    mockManagementResolution = {
      onekeyUserId: resolutionSource.onekeyUserId,
      subscriptionSourceKey: resolutionSource.subscriptionSourceKey,
      target: {
        type: 'external',
        url: 'https://example.com/stale-manage',
      },
    };
    render(<PrimeUserInfoMoreButton />);

    fireEvent.click(
      screen.getByTestId(PrimeTestIDs.manageSubscriptionMenuItem),
    );

    expect(mockOpenUrlExternal).not.toHaveBeenCalled();
    expect(mockToastMessage).toHaveBeenCalledWith({
      title: ETranslations.prime_subscription_management_unsupported__msg,
    });
  });
});
