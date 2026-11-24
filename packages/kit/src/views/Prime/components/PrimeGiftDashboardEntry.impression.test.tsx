/** @jest-environment jsdom */

import type { ReactNode, Ref } from 'react';

import { render } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PrimeGiftDashboardEntry } from './PrimeGiftDashboardEntry';

import type { IPrimeGiftClaimableDevice } from '../hooks/primeGiftClaimableDevices';

const messages: Record<string, string> = enMessages;
const mockShown = jest.fn();

jest.mock('../hooks/useOpenPrimeGiftClaim', () => ({
  useOpenPrimeGiftClaim: () => jest.fn(),
}));

jest.mock('@react-navigation/core', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useIsFocused: () => true,
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeGiftOfferShown: (...args: unknown[]) => {
          mockShown(...args);
        },
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => undefined,
}));

jest.mock('@onekeyhq/kit/src/components/WalletAvatar', () => ({
  WalletAvatar: () => null,
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Frame = React.forwardRef(function Frame(
    {
      children,
      testID,
    }: {
      children?: ReactNode;
      testID?: string;
    },
    ref: Ref<HTMLElement>,
  ) {
    return React.createElement('div', { 'data-testid': testID, ref }, children);
  });
  return {
    Icon: () => null,
    SizableText: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    XStack: Frame,
    YStack: Frame,
  };
});

function device(serialNo: string): IPrimeGiftClaimableDevice {
  return {
    serialNo,
    createdAt: 1,
    device: {
      name: 'OneKey Pro 2',
      uuid: serialNo,
      connectId: serialNo,
      deviceId: serialNo,
      deviceType: 'pro2',
    },
    wallet: { id: serialNo, name: serialNo },
    eligibility: {
      sno: serialNo,
      eligible: true,
      hasUnclaimedGift: true,
      giftDays: 180,
      giftMonths: 6,
    },
  } as IPrimeGiftClaimableDevice;
}

let lastIntersectCallback: IntersectionObserverCallback | undefined;

function emitIntersection(node: Element = document.body) {
  lastIntersectCallback?.(
    [
      {
        isIntersecting: true,
        target: node,
        boundingClientRect: node.getBoundingClientRect(),
        intersectionRect: node.getBoundingClientRect(),
        rootBounds: null,
        time: 0,
        intersectionRatio: 1,
      },
    ],
    {} as IntersectionObserver,
  );
}

function renderEntry(devices: IPrimeGiftClaimableDevice[]) {
  const view = render(
    <IntlProvider locale="en" messages={messages}>
      <PrimeGiftDashboardEntry devices={devices} />
    </IntlProvider>,
  );
  emitIntersection();
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  platformEnv.isNative = false;
  lastIntersectCallback = undefined;
  class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      lastIntersectCallback = callback;
    }

    observe() {}

    disconnect() {}

    unobserve() {}
  }
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

it('does not log while no device is claimable', () => {
  const view = renderEntry([]);
  expect(mockShown).not.toHaveBeenCalled();
  view.rerender(
    <IntlProvider locale="en" messages={messages}>
      <PrimeGiftDashboardEntry devices={[device('SN1')]} />
    </IntlProvider>,
  );
  emitIntersection();
  expect(mockShown).toHaveBeenCalledTimes(1);
  expect(mockShown).toHaveBeenCalledWith({
    source: 'primeDashboard',
    deviceCount: 1,
  });
});

it('logs one dashboard impression when another claimable device arrives', () => {
  const view = renderEntry([device('SN1')]);
  expect(mockShown).toHaveBeenCalledTimes(1);
  expect(mockShown).toHaveBeenCalledWith({
    source: 'primeDashboard',
    deviceCount: 1,
  });

  view.rerender(
    <IntlProvider locale="en" messages={messages}>
      <PrimeGiftDashboardEntry devices={[device('SN1'), device('SN2')]} />
    </IntlProvider>,
  );
  emitIntersection();
  expect(mockShown).toHaveBeenCalledTimes(1);
  expect(mockShown).toHaveBeenCalledWith({
    source: 'primeDashboard',
    deviceCount: 1,
  });
});

it('logs again after the dashboard entry leaves and returns', () => {
  const view = renderEntry([device('SN1')]);
  view.unmount();
  renderEntry([device('SN1'), device('SN2')]);
  expect(mockShown).toHaveBeenCalledTimes(2);
  expect(mockShown).toHaveBeenLastCalledWith({
    source: 'primeDashboard',
    deviceCount: 2,
  });
});
