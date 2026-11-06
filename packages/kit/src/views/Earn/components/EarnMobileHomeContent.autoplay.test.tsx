/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { render } from '@testing-library/react';

import type { IEarnPageBannerListItem } from '@onekeyhq/shared/types/earn';

import { EarnMobileHomeContent } from './EarnMobileHomeContent';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'FAQ' }),
}));

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    HeaderScrollGestureWrapper: Wrapper,
    RefreshControl: () => null,
    ScrollView: ({
      children,
      display,
      opacity,
      pointerEvents,
      accessibilityElementsHidden,
      importantForAccessibility,
    }: PropsWithChildren<{
      display?: string;
      opacity?: number;
      pointerEvents?: string;
      accessibilityElementsHidden?: boolean;
      importantForAccessibility?: string;
    }>) => (
      <div
        data-testid="earn-scroll"
        data-display={display}
        data-opacity={opacity}
        data-pointer={pointerEvents}
        data-a11y-hidden={String(accessibilityElementsHidden)}
        data-a11y-mode={importantForAccessibility}
      >
        {children}
      </div>
    ),
    SizableText: Wrapper,
    YStack: Wrapper,
    useScrollContentTabBarOffset: () => 0,
  };
});
jest.mock('./AvailableAssetsFlatList', () => ({
  AvailableAssetsFlatList: () => null,
}));
jest.mock('./EarnHomeBanner', () => ({
  EARN_HOME_BANNER_BLOCK_HEIGHT: 230,
  EarnHomeBanner: ({ autoPlayEnabled }: { autoPlayEnabled: boolean }) => (
    <span data-testid="earn-banner" data-autoplay={String(autoPlayEnabled)} />
  ),
}));
jest.mock('./EarnHomeShortcuts', () => ({ EarnHomeShortcuts: () => null }));
jest.mock('./FAQContent', () => ({ FAQContent: () => null }));
jest.mock('./Overview', () => ({ Overview: () => null }));
jest.mock('./Recommended', () => ({ Recommended: () => null }));

const EMPTY_BANNERS: IEarnPageBannerListItem[] = [];
const EMPTY_FAQS: Array<{ question: string; answer: string }> = [];
const noop = () => undefined;
const refresh = async () => undefined;

function view(
  showContent: boolean,
  keepHiddenLayout: boolean,
  isActive: boolean,
  bannerAutoPlayEnabled: boolean,
) {
  return (
    <EarnMobileHomeContent
      bannerList={EMPTY_BANNERS}
      isBannerLoading={false}
      faqList={EMPTY_FAQS}
      isFaqLoading={false}
      isActive={isActive}
      bannerAutoPlayEnabled={bannerAutoPlayEnabled}
      showContent={showContent}
      keepHiddenLayout={keepHiddenLayout}
      isRefreshing={false}
      isPullRefreshing={false}
      onRefresh={refresh}
      onOpenBorrow={noop}
      onOpenPortfolio={noop}
      onOpenTokens={noop}
      onOpenProtocols={noop}
    />
  );
}

it('retains hidden iOS pager layout without allowing touches, accessibility or autoplay', () => {
  const screen = render(view(false, true, false, false));
  const scroll = screen.getByTestId('earn-scroll');
  expect(scroll.getAttribute('data-display')).toBe('flex');
  expect(scroll.getAttribute('data-opacity')).toBe('0');
  expect(scroll.getAttribute('data-pointer')).toBe('none');
  expect(scroll.getAttribute('data-a11y-hidden')).toBe('true');
  expect(scroll.getAttribute('data-a11y-mode')).toBe('no-hide-descendants');
  expect(screen.getByTestId('earn-banner').getAttribute('data-autoplay')).toBe(
    'false',
  );

  screen.rerender(view(true, true, true, true));
  expect(scroll.getAttribute('data-display')).toBe('flex');
  expect(scroll.hasAttribute('data-opacity')).toBe(false);
  expect(scroll.hasAttribute('data-pointer')).toBe(false);
  expect(screen.getByTestId('earn-banner').getAttribute('data-autoplay')).toBe(
    'true',
  );
});

it('keeps other hosts hidden with display:none and pauses while visible during a transition', () => {
  const screen = render(view(false, false, false, false));
  expect(screen.getByTestId('earn-scroll').getAttribute('data-display')).toBe(
    'none',
  );
  expect(screen.getByTestId('earn-scroll').hasAttribute('data-opacity')).toBe(
    false,
  );
  screen.rerender(view(true, true, true, false));
  expect(screen.getByTestId('earn-scroll').getAttribute('data-display')).toBe(
    'flex',
  );
  expect(screen.getByTestId('earn-banner').getAttribute('data-autoplay')).toBe(
    'false',
  );
});
