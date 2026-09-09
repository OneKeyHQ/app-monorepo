/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import type { IEarnPageBannerListItem } from '@onekeyhq/shared/types/earn';

import { EarnHomeBanner } from './EarnHomeBanner';

jest.mock('@onekeyhq/components', () => ({
  BlurView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Carousel: () => <div data-testid="banner-carousel" />,
  Image: () => null,
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Skeleton: () => <div data-testid="banner-skeleton" />,
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  useCarouselPressSuppressor: () => () => false,
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
});
