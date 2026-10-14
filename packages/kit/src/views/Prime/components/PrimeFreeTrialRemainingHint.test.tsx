/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type {
  IPrimeFreeTrialAtomData,
  IPrimeFreeTrialFeatureQuota,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { PrimeFreeTrialRemainingHint } from './PrimeFreeTrialRemainingHint';

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
  return {
    SizableText: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
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
      <PrimeFreeTrialRemainingHint
        featureId={EPrimeFeatures.AddressRiskCheck}
      />,
    );

    // Not open has no reset date: the exact sentence, nothing appended, and
    // no "Get Prime" (the main button leads there).
    expect(screen.getByText('暂未开放免费体验')).toBeTruthy();
    expect(screen.queryByText('获取 Prime')).toBeNull();
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

  it('says the uses are gone at 0, without a "Get Prime"', () => {
    setRemaining(0);
    render(<PrimeFreeTrialRemainingHint featureId={EPrimeFeatures.BulkSend} />);

    expect(screen.getByText(/^本月免费次数已用完。.+ 重置$/)).toBeTruthy();
    expect(screen.queryByText('获取 Prime')).toBeNull();
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
});
