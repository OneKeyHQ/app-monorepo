/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IEarnPageBannerListItem } from '@onekeyhq/shared/types/earn';

import { EarnTestIDs } from '../testIDs';

import { EarnHomeBanner } from './EarnHomeBanner';

type IMockImageHandlers = {
  onDisplay?: () => void;
  onError?: () => void;
};

const mockImageHandlers: Record<string, IMockImageHandlers> = {};
const mockPressHandlers: Record<string, (() => unknown) | undefined> = {};
const mockUseReducedMotion = jest.fn(() => false);

jest.mock('@onekeyhq/components', () => {
  const MockStack = ({
    children,
    testID,
    opacity,
    pointerEvents,
    'aria-hidden': ariaHidden,
    transition,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    opacity?: number;
    pointerEvents?: string;
    'aria-hidden'?: boolean;
    transition?: string;
    onPress?: () => unknown;
  }) => {
    if (testID) {
      mockPressHandlers[testID] = onPress;
    }
    return (
      <div
        data-testid={testID}
        data-opacity={opacity}
        data-pointer-events={pointerEvents}
        aria-hidden={ariaHidden}
        data-transition={transition}
      >
        {children}
      </div>
    );
  };
  return {
    BlurView: () => <div data-testid="banner-glass" />,
    // Pages are keyed by index, like the real pager, so a refreshed list
    // hands an existing card a different banner.
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
          <div key={index}>{renderItem({ item, index })}</div>
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
  StyleSheet: { hairlineWidth: 1 },
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useReducedMotion: () => mockUseReducedMotion(),
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

  const linkedBanner: IEarnPageBannerListItem = {
    ...campaignBanner,
    button: 'Join',
    href: 'https://example.com/earn',
    hrefType: 'external',
  };

  // The copy and the bottom-bar content each sit in their own fading layer.
  const getLayer = (text: string) =>
    screen.getByText(text).closest('[data-opacity]');
  const getLayerOpacity = (text: string) =>
    getLayer(text)?.getAttribute('data-opacity');
  const showArtwork = (url = campaignBanner.backgroundImage) =>
    act(() => {
      mockImageHandlers[url]?.onDisplay?.();
    });
  const failArtwork = (url = campaignBanner.backgroundImage) =>
    act(() => {
      mockImageHandlers[url]?.onError?.();
    });

  afterEach(() => {
    jest.useRealTimers();
    mockUseReducedMotion.mockReturnValue(false);
    jest.mocked(openUrlExternal).mockClear();
  });

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

    showArtwork();

    expect(getLayerOpacity(campaignBanner.imageTitle ?? '')).toBe('1');
    expect(getLayerOpacity(campaignBanner.title)).toBe('1');
    expect(screen.getByTestId('banner-glass')).toBeTruthy();
  });

  it('keeps only the bottom bar when the artwork fails to load', () => {
    render(<EarnHomeBanner banners={[campaignBanner]} isLoading={false} />);

    failArtwork();

    expect(getLayerOpacity(campaignBanner.imageTitle ?? '')).toBe('0');
    expect(getLayerOpacity(campaignBanner.title)).toBe('1');
    expect(screen.getByTestId('banner-glass')).toBeTruthy();
  });

  it('shows the bar when the artwork is slow, and the copy once it lands', () => {
    jest.useFakeTimers();
    render(<EarnHomeBanner banners={[campaignBanner]} isLoading={false} />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(getLayerOpacity(campaignBanner.title)).toBe('0');

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(getLayerOpacity(campaignBanner.title)).toBe('1');
    expect(getLayerOpacity(campaignBanner.imageTitle ?? '')).toBe('0');
    expect(screen.getByTestId('banner-glass')).toBeTruthy();

    showArtwork();

    expect(getLayerOpacity(campaignBanner.imageTitle ?? '')).toBe('1');
  });

  it('ignores taps and hides its content from assistive tech while loading', async () => {
    const cardTestID = EarnTestIDs.bannerItem(linkedBanner.bannerId);
    render(<EarnHomeBanner banners={[linkedBanner]} isLoading={false} />);
    const barLayer = getLayer(linkedBanner.title);

    expect(mockPressHandlers[cardTestID]).toBeUndefined();
    expect(barLayer?.getAttribute('data-pointer-events')).toBe('none');
    expect(barLayer?.getAttribute('aria-hidden')).toBe('true');

    showArtwork();

    expect(barLayer?.getAttribute('data-pointer-events')).toBe('auto');
    expect(barLayer?.getAttribute('aria-hidden')).toBe('false');
    await act(async () => {
      await mockPressHandlers[cardTestID]?.();
    });
    expect(openUrlExternal).toHaveBeenCalledWith(linkedBanner.href);
  });

  it('starts over when the artwork URL changes', () => {
    const { rerender } = render(
      <EarnHomeBanner banners={[campaignBanner]} isLoading={false} />,
    );
    showArtwork();
    expect(getLayerOpacity(campaignBanner.imageTitle ?? '')).toBe('1');

    const nextImage = 'https://example.com/next-banner.png';
    rerender(
      <EarnHomeBanner
        banners={[{ ...campaignBanner, backgroundImage: nextImage }]}
        isLoading={false}
      />,
    );

    expect(getLayerOpacity(campaignBanner.imageTitle ?? '')).toBe('0');
    showArtwork(nextImage);
    expect(getLayerOpacity(campaignBanner.imageTitle ?? '')).toBe('1');
  });

  it('brings the copy back if a failed artwork loads after all', () => {
    render(<EarnHomeBanner banners={[campaignBanner]} isLoading={false} />);

    failArtwork();
    expect(getLayerOpacity(campaignBanner.imageTitle ?? '')).toBe('0');

    showArtwork();
    expect(getLayerOpacity(campaignBanner.imageTitle ?? '')).toBe('1');
  });

  it('drops the fades and the press spring under Reduce Motion', () => {
    const cardTestID = EarnTestIDs.bannerItem(linkedBanner.bannerId);
    const { unmount } = render(
      <EarnHomeBanner banners={[linkedBanner]} isLoading={false} />,
    );
    expect(
      getLayer(linkedBanner.imageTitle ?? '')?.getAttribute('data-transition'),
    ).toBe('quick');
    expect(screen.getByTestId(cardTestID).getAttribute('data-transition')).toBe(
      'fast',
    );
    unmount();

    mockUseReducedMotion.mockReturnValue(true);
    render(<EarnHomeBanner banners={[linkedBanner]} isLoading={false} />);

    expect(
      getLayer(linkedBanner.imageTitle ?? '')?.hasAttribute('data-transition'),
    ).toBe(false);
    expect(screen.getByTestId(cardTestID).hasAttribute('data-transition')).toBe(
      false,
    );
  });

  it('keeps wrapped copy from ending on a lone word', () => {
    render(
      <EarnHomeBanner
        banners={[
          { ...campaignBanner, bannerId: 'bound' },
          {
            ...campaignBanner,
            bannerId: 'double-space',
            imageTitle: 'Earn with  Bitway',
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
    // A run of spaces collapses into the one no-break space.
    expect(getExactText('Earn with\u00A0Bitway')).toBeTruthy();
    // A pair too long to share a line stays breakable.
    expect(
      getExactText('Deposit USDT and earn onchain-yield-bearing rewards'),
    ).toBeTruthy();
    // A single word after an ops-forced newline is left alone.
    expect(getExactText('Earn up to 7.5% APR\nBitway')).toBeTruthy();
    expect(getExactText('Simple onchain\u00A0savings')).toBeTruthy();
  });

  it('leaves one long unbroken token alone, in linear time', () => {
    // The previous end-anchored regex took seconds on this token.
    const token = 'A'.repeat(100_000);
    const startedAt = performance.now();
    render(
      <EarnHomeBanner
        banners={[{ ...campaignBanner, imageTitle: token }]}
        isLoading={false}
      />,
    );

    expect(performance.now() - startedAt).toBeLessThan(1000);
    expect(screen.getByText(token)).toBeTruthy();
  });
});
