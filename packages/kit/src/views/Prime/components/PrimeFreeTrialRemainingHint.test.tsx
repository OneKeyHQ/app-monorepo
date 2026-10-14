/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import type {
  IPrimeFreeTrialAtomData,
  IPrimeFreeTrialFeatureQuota,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { PrimeFreeTrialRemainingHint } from './PrimeFreeTrialRemainingHint';

const mockPushFullModal = jest.fn();
const mockDialogClose = jest.fn();
const mockUpgradeClick = jest.fn();
const mockParentPress = jest.fn();
const mockRefreshQuota = jest.fn();
let mockQuota: IPrimeFreeTrialAtomData['quota'];
let mockConfig: IPrimeFreeTrialAtomData['config'];

// The hint reads its copy from the zh-CN catalog.
jest.mock('react-intl', () => {
  const actual: typeof import('react-intl') = jest.requireActual('react-intl');
  const intl = actual.createIntl({
    locale: 'zh-CN',
    messages: jest.requireActual('@onekeyhq/shared/src/locale/json/zh_CN.json'),
  });
  return { useIntl: () => intl };
});

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function Container({
    children,
    testID,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: (event: { stopPropagation: () => void }) => void;
  }) {
    return React.createElement(
      onPress ? 'button' : 'span',
      { 'data-testid': testID, onClick: onPress },
      children,
    );
  }
  return {
    Icon: () => null,
    SizableText: Container,
    XStack: Container,
    useDialogInstance: () => ({ close: mockDialogClose }),
    rootNavigationRef: { current: undefined },
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrimeFreeTrial: {
      refreshQuota: (params: unknown) => mockRefreshQuota(params) as unknown,
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushFullModal: mockPushFullModal }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimePersistAtom: () => [
    {
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'user-1',
      primeSubscription: { isActive: false },
    },
  ],
  usePrimeFreeTrialAtom: () => [{ quota: mockQuota, config: mockConfig }],
}));

jest.mock('../hooks/usePrimeFeatureAccess', () => ({
  isPrimeFreeTrialTravelMode: () => false,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeFreeTrialUpgradeClick: (...args: unknown[]) => {
          mockUpgradeClick(...args);
        },
      },
    },
  },
}));

function setFeatureQuota(feature: IPrimeFreeTrialFeatureQuota) {
  mockQuota = {
    status: 'success',
    onekeyUserId: 'user-1',
    updatedAt: Date.now(),
    data: {
      period: '2026-10',
      resetAt: Date.now() + 24 * 60 * 60 * 1000,
      features: [feature],
    },
  };
}

function setRemaining(remaining: number) {
  setFeatureQuota({
    featureId: EPrimeFeatures.BulkSend,
    unit: 'count',
    monthlyQuota: 3,
    used: 3 - remaining,
    remaining,
  });
}

function setTranslateRemaining(remaining: number) {
  setFeatureQuota({
    featureId: EPrimeFeatures.DAppTranslate,
    unit: 'token',
    monthlyQuota: 10_000,
    used: 10_000 - remaining,
    remaining,
  });
}

function setQuotaData(data: IPrimeFreeTrialAtomData['quota']['data']) {
  mockQuota = {
    status: 'success',
    onekeyUserId: 'user-1',
    updatedAt: Date.now(),
    data,
  };
}

describe('PrimeFreeTrialRemainingHint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = { status: 'idle' };
  });

  it('says Prime is needed when the feature has no free trial', () => {
    // Open features only: bulk send is missing, so it is not open.
    setRemaining(2);
    render(
      <div role="presentation" onClick={mockParentPress}>
        <PrimeFreeTrialRemainingHint
          featureId={EPrimeFeatures.AddressRiskCheck}
          networkId="evm--1"
        />
      </div>,
    );

    // Not open has no reset date: the exact sentence, nothing appended.
    expect(screen.getByText('暂未开放免费体验')).toBeTruthy();
    fireEvent.click(screen.getByTestId('prime-free-trial-hint-get-prime-btn'));

    expect(mockUpgradeClick).toHaveBeenCalledWith({
      featureName: EPrimeFeatures.AddressRiskCheck,
      featureId: EPrimeFeatures.AddressRiskCheck,
    });
    expect(mockPushFullModal).toHaveBeenCalledWith(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeDashboard,
      params: {
        fromFeature: EPrimeFeatures.AddressRiskCheck,
        networkId: 'evm--1',
        freeTrialReason: 'notOpen',
      },
    });
    expect(mockDialogClose).toHaveBeenCalledTimes(1);
    expect(mockParentPress).not.toHaveBeenCalled();
  });

  it('reads a null quota by the public config', () => {
    setQuotaData(null);
    mockConfig = {
      status: 'success',
      data: { enabled: false, features: [] },
    };
    const { rerender } = render(
      <PrimeFreeTrialRemainingHint featureId={EPrimeFeatures.BulkSend} />,
    );
    expect(screen.getByText('暂未开放免费体验')).toBeTruthy();

    // An unknown config is never read as not open.
    mockConfig = { status: 'error' };
    rerender(
      <PrimeFreeTrialRemainingHint featureId={EPrimeFeatures.BulkSend} />,
    );
    expect(screen.queryByText('暂未开放免费体验')).toBeNull();
    expect(screen.queryByText('获取 Prime')).toBeNull();
  });

  it('hides while the quota is unknown', () => {
    mockQuota = { status: 'error', onekeyUserId: 'user-1' };
    render(<PrimeFreeTrialRemainingHint featureId={EPrimeFeatures.BulkSend} />);

    expect(screen.queryByText('暂未开放免费体验')).toBeNull();
    expect(screen.queryByText('获取 Prime')).toBeNull();
  });

  it('shows the remaining uses while some are left', () => {
    setRemaining(2);
    render(<PrimeFreeTrialRemainingHint featureId={EPrimeFeatures.BulkSend} />);

    expect(screen.getByText('本月还可免费使用 2 次')).toBeTruthy();
    expect(screen.queryByText('获取 Prime')).toBeNull();
  });

  it('offers the same "Get Prime" as the exhausted toast at 0', () => {
    setRemaining(0);
    render(
      // The bulk revoke dialog puts the hint inside its pressable card.
      <div role="presentation" onClick={mockParentPress}>
        <PrimeFreeTrialRemainingHint
          featureId={EPrimeFeatures.BulkSend}
          networkId="evm--1"
        />
      </div>,
    );

    expect(screen.getByText(/^本月免费次数已用完。.+ 重置$/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('prime-free-trial-hint-get-prime-btn'));

    expect(mockUpgradeClick).toHaveBeenCalledWith({
      featureName: EPrimeFeatures.BulkSend,
      featureId: EPrimeFeatures.BulkSend,
    });
    expect(mockPushFullModal).toHaveBeenCalledWith(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeDashboard,
      params: {
        fromFeature: EPrimeFeatures.BulkSend,
        networkId: 'evm--1',
        freeTrialReason: 'exhausted',
      },
    });
    expect(mockDialogClose).toHaveBeenCalledTimes(1);
    expect(mockParentPress).not.toHaveBeenCalled();
  });

  it('says when a quota held by a live reservation comes back', () => {
    setFeatureQuota({
      featureId: EPrimeFeatures.BulkSend,
      unit: 'count',
      monthlyQuota: 1,
      used: 1,
      remaining: 0,
      reserved: 1,
      reservationExpiresAt: Date.now() + 10 * 60 * 1000,
    });
    render(<PrimeFreeTrialRemainingHint featureId={EPrimeFeatures.BulkSend} />);

    expect(
      screen.getByText(/^上次使用未结束。若已中断，.+ 前退回次数$/),
    ).toBeTruthy();
    expect(screen.queryByText(/^本月免费次数已用完/)).toBeNull();
    expect(screen.getByText('获取 Prime')).toBeTruthy();
  });

  it('reads an ended reservation as used up', () => {
    setFeatureQuota({
      featureId: EPrimeFeatures.BulkSend,
      unit: 'count',
      monthlyQuota: 1,
      used: 1,
      remaining: 0,
      reserved: 1,
      reservationExpiresAt: Date.now() - 1000,
    });
    render(<PrimeFreeTrialRemainingHint featureId={EPrimeFeatures.BulkSend} />);

    expect(screen.getByText(/^本月免费次数已用完。.+ 重置$/)).toBeTruthy();
  });

  describe('refresh when a reservation ends', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    function setReservationEnd(reservationExpiresAt: number) {
      setFeatureQuota({
        featureId: EPrimeFeatures.BulkSend,
        unit: 'count',
        monthlyQuota: 1,
        used: 1,
        remaining: 0,
        reserved: 1,
        reservationExpiresAt,
      });
    }

    it('still refreshes when the hint re-renders after the end', () => {
      setReservationEnd(Date.now() + 1000);
      const { rerender } = render(
        <PrimeFreeTrialRemainingHint featureId={EPrimeFeatures.BulkSend} />,
      );

      // The reservation ends, and the hint re-renders before the refresh,
      // which waits a grace period after the end.
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      rerender(
        <PrimeFreeTrialRemainingHint featureId={EPrimeFeatures.BulkSend} />,
      );
      expect(mockRefreshQuota).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1500);
      });
      expect(mockRefreshQuota).toHaveBeenCalledTimes(1);
    });

    it('refreshes a snapshot whose reservation already ended', () => {
      setReservationEnd(Date.now() - 1000);
      render(
        <PrimeFreeTrialRemainingHint featureId={EPrimeFeatures.BulkSend} />,
      );

      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(mockRefreshQuota).toHaveBeenCalledTimes(1);
    });
  });

  // Translate shows no hint at all, whatever its token quota.
  it.each([6329, 0])(
    'renders nothing for translate (%i tokens left)',
    (left) => {
      setTranslateRemaining(left);
      const { container } = render(
        <PrimeFreeTrialRemainingHint
          featureId={EPrimeFeatures.DAppTranslate}
        />,
      );
      expect(container.textContent).toBe('');
    },
  );

  it('opens the dashboard after beforeGetPrime settles', async () => {
    setRemaining(0);
    let closePopover: () => void = () => {};
    const beforeGetPrime = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          closePopover = resolve;
        }),
    );
    render(
      <PrimeFreeTrialRemainingHint
        featureId={EPrimeFeatures.BulkSend}
        beforeGetPrime={beforeGetPrime}
      />,
    );

    fireEvent.click(screen.getByTestId('prime-free-trial-hint-get-prime-btn'));
    expect(beforeGetPrime).toHaveBeenCalledTimes(1);
    expect(mockPushFullModal).not.toHaveBeenCalled();

    closePopover();
    await waitFor(() => {
      expect(mockPushFullModal).toHaveBeenCalledWith(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeDashboard,
        params: {
          fromFeature: EPrimeFeatures.BulkSend,
          networkId: undefined,
          freeTrialReason: 'exhausted',
        },
      });
    });
  });
});
