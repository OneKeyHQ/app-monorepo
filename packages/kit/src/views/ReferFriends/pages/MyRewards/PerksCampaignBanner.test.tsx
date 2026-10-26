/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

const mockPerksBannerShown = jest.fn();
const mockPerksBannerPressed = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Carousel: ({
      data,
      renderItem,
      onPageChanged,
    }: {
      data: Array<{ linkId: string }>;
      renderItem: (info: { item: { linkId: string } }) => ReactNode;
      onPageChanged?: (index: number) => void;
    }) =>
      React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () => onPageChanged?.(1),
          },
          'next',
        ),
        data.map((item) =>
          React.createElement(
            'div',
            { key: item.linkId },
            renderItem({ item }),
          ),
        ),
      ),
    Icon: () => null,
    Image: () => null,
    SizableText: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    Skeleton: () => null,
    XStack: ({
      children,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement(
        'div',
        { onClick: onPress, 'data-testid': testID },
        children,
      ),
    YStack: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
    useCarouselPressSuppressor: () => () => false,
  };
});

jest.mock('../InviteReward/components/useInviteCardStyle', () => ({
  useInviteHomeCardStyle: () => ({}),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    referral: {
      page: {
        perksBannerShown: (params: unknown) => {
          mockPerksBannerShown(params);
        },
        perksBannerPressed: (params: unknown) => {
          mockPerksBannerPressed(params);
        },
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/notificationsUtils', () => ({
  parseNotificationPayload: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en',
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: undefined, isLoading: false }),
}));

import { PerksCampaignBanner } from './PerksCampaignBanner';

const slides = [
  {
    linkId: 'btc-reward',
    title: 'BTC',
    description: 'Learn',
    mode: 1,
    payload: '{}',
    image: null,
  },
  {
    linkId: 'prime',
    title: 'Prime',
    description: 'Learn',
    mode: 1,
    payload: '{}',
    image: null,
  },
];

describe('PerksCampaignBanner', () => {
  beforeEach(() => {
    mockPerksBannerShown.mockClear();
    mockPerksBannerPressed.mockClear();
  });

  it('records each visible banner once and records a press', () => {
    const view = render(<PerksCampaignBanner items={slides} compact />);
    expect(mockPerksBannerShown).toHaveBeenCalledWith({ linkId: 'btc-reward' });

    fireEvent.click(screen.getByText('next'));
    expect(mockPerksBannerShown).toHaveBeenCalledWith({ linkId: 'prime' });
    fireEvent.click(screen.getByText('next'));
    expect(mockPerksBannerShown).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('perks-banner-btc-reward'));
    expect(mockPerksBannerPressed).toHaveBeenCalledWith({
      linkId: 'btc-reward',
    });

    view.unmount();
    render(<PerksCampaignBanner items={slides} compact />);
    expect(mockPerksBannerShown).toHaveBeenCalledTimes(2);
  });
});
