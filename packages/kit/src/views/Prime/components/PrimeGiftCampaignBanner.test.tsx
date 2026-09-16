/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import zhMessages from '@onekeyhq/shared/src/locale/json/zh_CN.json';
import { parseNotificationPayload } from '@onekeyhq/shared/src/utils/notificationsUtils';
import { PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT } from '@onekeyhq/shared/types/linkConfig';
import type { ILinkConfigItem } from '@onekeyhq/shared/types/linkConfig';

import { PrimeGiftCampaignBanner } from './PrimeGiftCampaignBanner';

const enTranslations: Record<string, string> = enMessages;
const zhTranslations: Record<string, string> = zhMessages;
const mockShown = jest.fn();
const mockClick = jest.fn();
let mockItem: ILinkConfigItem | undefined;
const campaignItem: ILinkConfigItem = {
  linkId: 'pro2_prime_claim_success_test',
  title: '如何在OneKey中交易永续合约',
  description: '如何在OneKey中交换和桥接加密货币',
  mode: 3,
  payload: 'https://onekey.so/',
  image: null,
};

jest.mock('../hooks/usePrimeGiftClaimSuccessLink', () => ({
  usePrimeGiftClaimSuccessLink: () => mockItem,
}));

jest.mock('@onekeyhq/shared/src/utils/notificationsUtils', () => ({
  parseNotificationPayload: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeGiftClaimSuccessBannerShown: (...args: unknown[]) => {
          mockShown(...args);
        },
        primeGiftClaimSuccessBannerClick: (...args: unknown[]) => {
          mockClick(...args);
        },
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
}));

jest.mock('@react-navigation/core', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useIsFocused: () => true,
    useFocusEffect: (effect: () => void | (() => void)) =>
      React.useEffect(effect, [effect]),
  };
});

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Container = React.forwardRef(function Container(
    {
      children,
      testID,
      onPress,
    }: {
      children?: ReactNode;
      testID?: string;
      onPress?: () => void;
    },
    ref: React.Ref<HTMLElement>,
  ) {
    return React.createElement(
      onPress ? 'button' : 'div',
      {
        'data-testid': testID,
        onClick: onPress,
        ref,
      },
      children,
    );
  });
  return {
    XStack: Container,
    YStack: Container,
    SizableText: Container,
    Image: () => null,
    Icon: () => null,
  };
});

let autoIntersect = true;
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

function renderBanner(locale: 'zh-CN' | 'en-US' = 'zh-CN') {
  const messages = locale === 'zh-CN' ? zhTranslations : enTranslations;
  return render(
    <IntlProvider locale={locale} messages={messages}>
      <PrimeGiftCampaignBanner />
    </IntlProvider>,
  );
}

describe('PrimeGiftCampaignBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockItem = undefined;
    autoIntersect = true;
    lastIntersectCallback = undefined;
    class AutoIntersectObserver {
      constructor(callback: IntersectionObserverCallback) {
        lastIntersectCallback = callback;
      }

      observe(node: Element) {
        if (autoIntersect) emitIntersection(node);
      }

      disconnect() {}

      unobserve() {}
    }
    globalThis.IntersectionObserver =
      AutoIntersectObserver as unknown as typeof IntersectionObserver;
  });

  it('hides when Utility returns no item', () => {
    mockItem = undefined;
    renderBanner();
    expect(screen.queryByTestId('prime-gift-campaign-banner')).toBeNull();
    expect(mockShown).not.toHaveBeenCalled();
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('renders server title and description as plain text and uses learn more', () => {
    mockItem = campaignItem;
    renderBanner();
    expect(screen.getByText(campaignItem.title)).toBeTruthy();
    expect(screen.getByText(campaignItem.description)).toBeTruthy();
    expect(screen.getByText('了解更多')).toBeTruthy();
    expect(screen.queryByText(campaignItem.title)).not.toBeNull();
  });

  it('keeps the CTA on the client i18n key when the UI locale changes', () => {
    mockItem = campaignItem;
    const view = renderBanner('zh-CN');
    expect(screen.getByText('了解更多')).toBeTruthy();
    act(() => {
      view.rerender(
        <IntlProvider locale="en-US" messages={enTranslations}>
          <PrimeGiftCampaignBanner />
        </IntlProvider>,
      );
    });
    expect(screen.getByText('Learn more')).toBeTruthy();
    expect(screen.getByText(campaignItem.title)).toBeTruthy();
  });

  it('logs a click and dispatches parseNotificationPayload', () => {
    mockItem = campaignItem;
    renderBanner();
    fireEvent.click(screen.getByTestId('prime-gift-campaign-banner'));
    expect(mockClick).toHaveBeenCalledWith({
      slot: PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
      linkId: campaignItem.linkId,
    });
    expect(parseNotificationPayload).toHaveBeenCalledWith(
      campaignItem.mode,
      campaignItem.payload,
      expect.any(Function),
    );
  });

  it('does not log impression until the rendered banner is visible', () => {
    mockItem = campaignItem;
    autoIntersect = false;
    renderBanner();
    expect(screen.getByTestId('prime-gift-campaign-banner')).toBeTruthy();
    expect(mockShown).not.toHaveBeenCalled();
    act(() => {
      emitIntersection(screen.getByTestId('prime-gift-campaign-banner'));
    });
    expect(mockShown).toHaveBeenCalledTimes(1);
    expect(mockShown).toHaveBeenCalledWith({
      slot: PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
      linkId: campaignItem.linkId,
    });
  });
});
