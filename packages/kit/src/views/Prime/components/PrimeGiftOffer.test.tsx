/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IPrimeGiftEligibilityCache } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import zhMessages from '@onekeyhq/shared/src/locale/json/zh_CN.json';
import type { IPrimeGiftEligibility } from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { PrimeGiftOffer } from './PrimeGiftOffer';

const enTranslations: Record<string, string> = enMessages;
const zhTranslations: Record<string, string> = zhMessages;
const mockNavigate = jest.fn();
const mockListeners = new Set<(event: { serialNo: string }) => void>();
let mockCache: IPrimeGiftEligibilityCache = {};
const mockCacheListeners = new Set<() => void>();
const mockFetchEligibility = jest.fn<
  Promise<IPrimeGiftEligibility>,
  [string]
>();

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    usePrimeGiftEligibilityPersistAtom: () => [
      React.useSyncExternalStore(
        (listener) => {
          mockCacheListeners.add(listener);
          return () => mockCacheListeners.delete(listener);
        },
        () => mockCache,
      ),
    ],
  };
});

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  function Container({
    children,
    testID,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
  }) {
    return React.createElement(
      onPress ? 'button' : 'div',
      {
        'data-testid': testID,
        onClick: onPress,
      },
      children,
    );
  }
  return {
    XStack: Container,
    YStack: Container,
    SizableText: Container,
    Icon: () => null,
    useThemeName: () => 'light',
  };
});

jest.mock('@react-navigation/core', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) =>
      React.useEffect(effect, [effect]),
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockNavigate }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { servicePrime: { apiGetPrimeGiftEligibility: jest.fn() } },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { PrimeGiftRedeemed: 'PrimeGiftRedeemed' },
  appEventBus: {
    on: (_event: string, listener: (event: { serialNo: string }) => void) =>
      mockListeners.add(listener),
    off: (_event: string, listener: (event: { serialNo: string }) => void) =>
      mockListeners.delete(listener),
  },
}));

const servicePrime = jest.mocked(backgroundApiProxy.servicePrime);
const device: IDBDevice = {
  id: 'db-device-a',
  connectId: 'connect-a',
  deviceId: 'device-a',
  uuid: 'DEVICE-A',
  deviceType: EDeviceType.Pro,
  name: 'OneKey hardware wallet',
  features: '{}',
  settingsRaw: '{}',
  createdAt: 0,
  updatedAt: 0,
};
const eligible: IPrimeGiftEligibility = {
  sno: 'DEVICE-A',
  eligible: true,
  hasUnclaimedGift: true,
  giftDays: 360,
  giftMonths: 12,
};
const offerTestId = 'prime-gift-offer-deviceDetails';

function renderOffer() {
  return render(<PrimeGiftOffer device={device} source="deviceDetails" />, {
    wrapper: ({ children }) => (
      <IntlProvider locale="zh-CN" messages={zhTranslations}>
        <>{children}</>
      </IntlProvider>
    ),
  });
}

describe('PrimeGiftOffer real server eligibility', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockListeners.clear();
    mockCache = {};
    mockCacheListeners.clear();
    servicePrime.apiGetPrimeGiftEligibility.mockImplementation(
      async ({ serialNo }) => {
        const eligibility = await mockFetchEligibility(serialNo);
        mockCache = { ...mockCache, [serialNo]: eligibility };
        mockCacheListeners.forEach((listener) => listener());
        return eligibility;
      },
    );
  });

  it('shows only after a successful response and uses the returned duration', async () => {
    let resolve!: (result: IPrimeGiftEligibility) => void;
    mockFetchEligibility.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    renderOffer();
    expect(screen.queryByTestId(offerTestId)).toBeNull();
    await act(async () => {
      resolve(eligible);
    });
    expect(screen.getByText('附赠 12 个月 Prime')).toBeTruthy();
    fireEvent.click(screen.getByTestId(offerTestId));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('updates the offer duration and reused claim action when the locale changes', async () => {
    mockCache = { 'DEVICE-A': eligible };
    mockFetchEligibility.mockResolvedValue(eligible);
    const view = render(
      <IntlProvider locale="zh-CN" messages={zhTranslations}>
        <PrimeGiftOffer device={device} source="deviceDetails" />
      </IntlProvider>,
    );
    expect(screen.getByText('附赠 12 个月 Prime')).toBeTruthy();
    expect(screen.getByText('领取')).toBeTruthy();
    await act(async () => {
      view.rerender(
        <IntlProvider locale="en-US" messages={enTranslations}>
          <PrimeGiftOffer device={device} source="deviceDetails" />
        </IntlProvider>,
      );
    });
    expect(screen.getByText('12 months of Prime included')).toBeTruthy();
    expect(screen.getByText('Claim')).toBeTruthy();
    expect(screen.queryByText('附赠 12 个月 Prime')).toBeNull();
  });

  it.each([
    { eligible: true, hasUnclaimedGift: false },
    { eligible: false, hasUnclaimedGift: false },
    { eligible: false, hasUnclaimedGift: true },
  ])('hides the offer when either server flag is false: %j', async (flags) => {
    mockFetchEligibility.mockResolvedValue({
      ...eligible,
      ...flags,
    });
    await act(async () => {
      renderOffer();
    });
    expect(screen.queryByTestId(offerTestId)).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not show a fabricated offer when the request fails', async () => {
    mockFetchEligibility.mockRejectedValue(
      new Error('Eligibility unavailable'),
    );
    await act(async () => {
      renderOffer();
    });
    expect(screen.queryByTestId(offerTestId)).toBeNull();
  });

  it('waits for the prefetch result and still refreshes after redemption', async () => {
    render(
      <IntlProvider locale="zh-CN" messages={zhTranslations}>
        <PrimeGiftOffer
          device={device}
          source="onboarding"
          skipInitialRefresh
        />
      </IntlProvider>,
    );
    expect(screen.queryByTestId('prime-gift-offer-onboarding')).toBeNull();
    expect(servicePrime.apiGetPrimeGiftEligibility.mock.calls).toHaveLength(0);
    act(() => {
      mockCache = { [device.uuid]: eligible };
      mockCacheListeners.forEach((listener) => listener());
    });
    expect(screen.getByTestId('prime-gift-offer-onboarding')).toBeTruthy();
    mockFetchEligibility.mockResolvedValue({
      ...eligible,
      hasUnclaimedGift: false,
    });
    await act(async () => {
      mockListeners.forEach((listener) => listener({ serialNo: device.uuid }));
    });
    expect(screen.queryByTestId('prime-gift-offer-onboarding')).toBeNull();
    expect(servicePrime.apiGetPrimeGiftEligibility.mock.calls).toHaveLength(1);
  });

  it.each([undefined, null, '', 0] as const)(
    'displays days when the server month duration is %j',
    async (giftMonths) => {
      mockFetchEligibility.mockResolvedValue({
        ...eligible,
        giftMonths,
        giftDays: 45,
      });
      renderOffer();
      expect(await screen.findByText('附赠 45 天 Prime')).toBeTruthy();
      expect(screen.queryByText('附赠 6 个月 Prime')).toBeNull();
    },
  );

  it('keeps the offer during a refresh and hides it when the server reports no unclaimed gift', async () => {
    mockFetchEligibility.mockResolvedValue(eligible);
    renderOffer();
    await waitFor(() => expect(screen.getByTestId(offerTestId)).toBeTruthy());
    let resolve!: (result: IPrimeGiftEligibility) => void;
    mockFetchEligibility.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    act(() => {
      mockListeners.forEach((listener) => listener({ serialNo: 'DEVICE-A' }));
    });
    expect(screen.getByTestId(offerTestId)).toBeTruthy();
    await act(async () => {
      resolve({ ...eligible, hasUnclaimedGift: false });
    });
    expect(screen.queryByTestId(offerTestId)).toBeNull();
    expect(servicePrime.apiGetPrimeGiftEligibility.mock.calls).toHaveLength(2);
  });

  it('renders the persisted offer immediately and keeps it on a failed refresh', async () => {
    mockCache = { 'DEVICE-A': eligible };
    mockFetchEligibility.mockRejectedValue(new Error('Offline'));
    renderOffer();
    expect(screen.getByText('附赠 12 个月 Prime')).toBeTruthy();
    await act(async () => undefined);
    expect(screen.getByText('附赠 12 个月 Prime')).toBeTruthy();
    expect(servicePrime.apiGetPrimeGiftEligibility.mock.calls).toEqual([
      [{ serialNo: 'DEVICE-A' }],
    ]);
  });

  it('retains the same offer on re-entry while a slow refresh updates its duration', async () => {
    mockFetchEligibility.mockResolvedValue(eligible);
    const firstVisit = renderOffer();
    await screen.findByText('附赠 12 个月 Prime');
    firstVisit.unmount();
    let resolve!: (result: IPrimeGiftEligibility) => void;
    mockFetchEligibility.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    renderOffer();
    expect(screen.getByText('附赠 12 个月 Prime')).toBeTruthy();
    await act(async () => {
      resolve({ ...eligible, giftMonths: 0, giftDays: 45 });
    });
    expect(screen.getByText('附赠 45 天 Prime')).toBeTruthy();
  });

  it('does not show another device cached offer when switching serial numbers', async () => {
    mockCache = { 'DEVICE-A': eligible };
    mockFetchEligibility.mockRejectedValue(new Error('Offline'));
    const view = renderOffer();
    expect(screen.getByTestId(offerTestId)).toBeTruthy();
    await act(async () => {
      view.rerender(
        <PrimeGiftOffer
          device={{ ...device, uuid: 'DEVICE-B' }}
          source="deviceDetails"
        />,
      );
    });
    expect(screen.queryByTestId(offerTestId)).toBeNull();
  });
});
