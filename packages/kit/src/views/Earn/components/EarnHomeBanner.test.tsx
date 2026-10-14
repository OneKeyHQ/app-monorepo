/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import type { IEarnPageBannerListItem } from '@onekeyhq/shared/types/earn';

import { EarnHomeBanner } from './EarnHomeBanner';

type IMockImageHandlers = {
  onDisplay?: () => void;
  onError?: () => void;
};

const mockImageHandlers: Record<string, IMockImageHandlers> = {};

jest.mock('@onekeyhq/components', () => {
  const MockStack = ({
    children,
    opacity,
  }: {
    children?: ReactNode;
    opacity?: number;
  }) => <div data-opacity={opacity}>{children}</div>;
  return {
    BlurView: () => <div data-testid="banner-glass" />,
    Carousel: ({
      data,
      renderItem,
    }: {
      data: IEarnPageBannerListItem[];
      renderItem: (info: {
        item: IEarnPageBannerListItem;
        index: number;
      }) => ReactNode;
    }) => (
      <div data-testid="banner-carousel">
        {data.map((item, index) => (
          <div key={item.bannerId}>{renderItem({ item, index })}</div>
        ))}
      </div>
    ),
    Image: ({
      src,
      onDisplay,
      onError,
    }: { src: string } & IMockImageHandlers) => {
      mockImageHandlers[src] = { onDisplay, onError };
      return null;
    },
    LinearGradient: () => null,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Skeleton: () => <div data-testid="banner-skeleton" />,
    Stack: MockStack,
    Theme: ({ children }: { children?: ReactNode }) => children,
    XStack: MockStack,
    YStack: MockStack,
    useCarouselPressSuppressor: () => () => false,
    useThemeName: () => 'light',
  };
});

jest.mock('react-native', () => ({
  StyleSheet: {
    absoluteFill: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    create: <T,>(styles: T) => styles,
    hairlineWidth: 1,
  },
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useReducedMotion: () => false,
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('../../../routes/config/deeplink', () => ({
  handleDeepLinkUrl: jest.fn(),
  tryHandleOneKeyUniversalLink: jest.fn(),
}));

describe('EarnHomeBanner', () => {
  const banner: IEarnPageBannerListItem = {
    bannerId: 'banner-1',
    theme: 'light',
    backgroundImage: 'https://example.com/banner.png',
    icon: '',
    title: 'Banner',
    subtitle: '',
    button: '',
    href: '',
    hrefType: '',
  };

  const campaignBanner: IEarnPageBannerListItem = {
    ...banner,
    imageTitle: 'Earn up to 7.5% APR with Bitway',
    imageSubtitle: 'Deposit USDT, earn onchain yield',
    title: 'USDT Vault',
    subtitle: 'Bitway',
  };

  // The copy and the bottom-bar content each sit in their own fading layer.
  const getLayerOpacity = (text: string) =>
    screen
      .getByText(text)
      .closest('[data-opacity]')
      ?.getAttribute('data-opacity');

  it('reserves the banner block with a skeleton on a true cache miss', () => {
    render(<EarnHomeBanner banners={[]} isLoading />);

    expect(screen.getByTestId('banner-skeleton')).toBeTruthy();
  });

  it('renders nothing after an empty banner result resolves', () => {
    const { container } = render(
      <EarnHomeBanner banners={[]} isLoading={false} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('keeps an existing banner visible while refreshing', () => {
    render(<EarnHomeBanner banners={[banner]} isLoading />);

    expect(screen.getByTestId('banner-carousel')).toBeTruthy();
    expect(screen.queryByTestId('banner-skeleton')).toBeNull();
  });

  it('holds the copy and bottom bar until the artwork is on screen', () => {
    render(<EarnHomeBanner banners={[campaignBanner]} isLoading={false} />);

    expect(getLayerOpacity(campaignBanner.imageTitle ?? '')).toBe('0');
    expect(getLayerOpacity(campaignBanner.title)).toBe('0');
    expect(screen.queryByTestId('banner-glass')).toBeNull();

    act(() => {
      mockImageHandlers[campaignBanner.backgroundImage]?.onDisplay?.();
    });

    expect(getLayerOpacity(campaignBanner.imageTitle ?? '')).toBe('1');
    expect(getLayerOpacity(campaignBanner.title)).toBe('1');
    expect(screen.getByTestId('banner-glass')).toBeTruthy();
  });

  it('keeps only the bottom bar when the artwork fails to load', () => {
    render(<EarnHomeBanner banners={[campaignBanner]} isLoading={false} />);

    act(() => {
      mockImageHandlers[campaignBanner.backgroundImage]?.onError?.();
    });

    expect(getLayerOpacity(campaignBanner.imageTitle ?? '')).toBe('0');
    expect(getLayerOpacity(campaignBanner.title)).toBe('1');
    expect(screen.getByTestId('banner-glass')).toBeTruthy();
  });

  it('keeps wrapped copy from ending on a lone word', () => {
    render(
      <EarnHomeBanner
        banners={[
          { ...campaignBanner, bannerId: 'bound' },
          {
            ...campaignBanner,
            bannerId: 'long-pair',
            imageTitle: 'Earn with Bitway',
            imageSubtitle:
              'Deposit USDT and earn onchain-yield-bearing rewards',
          },
          {
            ...campaignBanner,
            bannerId: 'forced-break',
            imageTitle: 'Earn up to 7.5% APR\nBitway',
            imageSubtitle: 'Simple onchain savings ',
          },
        ]}
        isLoading={false}
      />,
    );
    // The default normalizer folds the no-break space into a plain one.
    const getExactText = (text: string) =>
      screen.getByText(text, { normalizer: (value) => value });

    expect(getExactText('Earn up to 7.5% APR with\u00A0Bitway')).toBeTruthy();
    expect(getExactText('Deposit USDT, earn onchain\u00A0yield')).toBeTruthy();
    // A pair too long to share a line stays breakable.
    expect(
      getExactText('Deposit USDT and earn onchain-yield-bearing rewards'),
    ).toBeTruthy();
    // A single word after an ops-forced newline is left alone.
    expect(getExactText('Earn up to 7.5% APR\nBitway')).toBeTruthy();
    expect(getExactText('Simple onchain\u00A0savings')).toBeTruthy();
  });
});
