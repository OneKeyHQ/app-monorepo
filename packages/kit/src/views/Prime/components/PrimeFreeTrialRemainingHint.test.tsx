/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
let mockQuota: IPrimeFreeTrialAtomData['quota'];

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
    servicePrimeFreeTrial: { refreshQuota: jest.fn() },
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
  usePrimeFreeTrialAtom: () => [{ quota: mockQuota }],
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

describe('PrimeFreeTrialRemainingHint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    expect(screen.getByText('本月免费次数已用完')).toBeTruthy();
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

  it('shows the remaining share of a token quota', () => {
    setTranslateRemaining(6329);
    const { rerender } = render(
      <PrimeFreeTrialRemainingHint featureId={EPrimeFeatures.DAppTranslate} />,
    );
    expect(screen.getByText('本月免费额度剩余 63%')).toBeTruthy();

    // A usable quota is never shown as 0%.
    setTranslateRemaining(12);
    rerender(
      <PrimeFreeTrialRemainingHint featureId={EPrimeFeatures.DAppTranslate} />,
    );
    expect(screen.getByText('本月免费额度剩余 1%')).toBeTruthy();
  });

  it('says the token quota is used up at 0', () => {
    setTranslateRemaining(0);
    render(
      <PrimeFreeTrialRemainingHint featureId={EPrimeFeatures.DAppTranslate} />,
    );

    expect(screen.getByText('本月免费额度已用完')).toBeTruthy();
    expect(screen.getByText('获取 Prime')).toBeTruthy();
  });

  it('opens the dashboard after beforeGetPrime settles', async () => {
    setTranslateRemaining(0);
    let closePopover: () => void = () => {};
    const beforeGetPrime = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          closePopover = resolve;
        }),
    );
    render(
      <PrimeFreeTrialRemainingHint
        featureId={EPrimeFeatures.DAppTranslate}
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
          fromFeature: EPrimeFeatures.DAppTranslate,
          networkId: undefined,
          freeTrialReason: 'exhausted',
        },
      });
    });
  });
});
