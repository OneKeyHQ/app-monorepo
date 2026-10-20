/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, cleanup, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import { WalletPortfolioSpotlight } from './WalletPortfolioSpotlight';

let mockIsFocused = true;
let mockIsAppVisible = true;
let mockIsNative = false;
const mockVisibilityListeners = new Set<(visible: boolean) => void>();
let mockPortfolioSyncUiState = { visible: true, disabled: false };
let mockDeviceStage = { step: 'off' };
type IMockRootState = {
  index: number;
  routes: { name: string }[];
};
let mockRootState: IMockRootState = {
  index: 0,
  routes: [{ name: ERootRoutes.Main }],
};
const mockRouterListeners = new Set<(state: IMockRootState) => void>();

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const deferredGuideHooks = jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredGuideBlocker')
  >('../../../../../../components/src/hooks/useDeferredGuideBlocker');
  return {
    ...deferredGuideHooks,
    useVisibilityChange: (callback: (visible: boolean) => void) => {
      React.useEffect(() => {
        mockVisibilityListeners.add(callback);
        return () => {
          mockVisibilityListeners.delete(callback);
        };
      }, [callback]);
    },
    rootNavigationRef: {
      current: { getRootState: () => mockRootState },
    },
    useOnRouterChange: (callback: (state: IMockRootState) => void) => {
      React.useEffect(() => {
        mockRouterListeners.add(callback);
        return () => {
          mockRouterListeners.delete(callback);
        };
      }, [callback]);
    },
  };
});

jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => mockIsAppVisible,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'en-US',
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockIsFocused,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/tokenList', () => ({
  usePortfolioSyncUiStateAtom: () => [mockPortfolioSyncUiState],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/hardware', () => ({
  useDeviceStageAtom: () => [mockDeviceStage],
}));

jest.mock('./WalletPortfolioIllustration', () => ({
  WalletPortfolioIllustration: () => (
    <div data-testid="portfolio-spotlight-illustration" />
  ),
}));

jest.mock('@onekeyhq/kit/src/components/Spotlight', () => {
  const { useIsDeferredGuideBlocked } = jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredGuideBlocker')
  >('../../../../../../components/src/hooks/useDeferredGuideBlocker');
  return {
    Spotlight: ({
      cardPadding,
      cardPaddingBottom,
      cardGap,
      cardMaxWidth,
      alignCardToAnchorEnd,
      cardBorderRadius,
      highlightBorderRadius,
      confirmButtonBorderRadius,
      confirmButtonPaddingHorizontal,
      children,
      closeOnBackdropPress,
      confirmText,
      deferUntilIdle,
      requireVisibleAnchor,
      delayMs,
      isVisible,
      illustration,
      illustrationGap,
      message,
      tourName,
    }: {
      cardPadding?: number;
      cardPaddingBottom?: number;
      cardGap?: number;
      cardMaxWidth?: number;
      alignCardToAnchorEnd?: boolean;
      cardBorderRadius?: number;
      highlightBorderRadius?: number;
      confirmButtonBorderRadius?: number | string;
      confirmButtonPaddingHorizontal?: number;
      children?: ReactNode;
      closeOnBackdropPress?: boolean;
      confirmText?: string;
      deferUntilIdle?: boolean;
      requireVisibleAnchor?: boolean;
      delayMs?: number;
      isVisible?: boolean;
      illustration?: ReactNode;
      illustrationGap?: number;
      message: string;
      tourName: string;
    }) => {
      const blocked = useIsDeferredGuideBlocked();
      return (
        <>
          {children}
          {isVisible && !(deferUntilIdle && blocked) ? (
            <div
              data-testid="portfolio-spotlight"
              data-card-padding={cardPadding}
              data-card-padding-bottom={cardPaddingBottom}
              data-card-gap={cardGap}
              data-card-max-width={cardMaxWidth}
              data-align-card-to-anchor-end={alignCardToAnchorEnd}
              data-card-border-radius={cardBorderRadius}
              data-highlight-border-radius={highlightBorderRadius}
              data-confirm-button-border-radius={confirmButtonBorderRadius}
              data-confirm-button-padding-horizontal={
                confirmButtonPaddingHorizontal
              }
              data-illustration-gap={illustrationGap}
              data-tour={tourName}
              data-backdrop-dismissible={closeOnBackdropPress}
              data-confirm-text={confirmText}
              data-defer-until-idle={deferUntilIdle}
              data-require-visible-anchor={requireVisibleAnchor}
              data-delay-ms={delayMs}
              data-message={message}
            >
              {illustration}
            </div>
          ) : null}
        </>
      );
    },
  };
});

function navigateRoot(name: ERootRoutes) {
  mockRootState = { index: 0, routes: [{ name }] };
  act(() => {
    mockRouterListeners.forEach((listener) => listener(mockRootState));
  });
}

function renderSpotlight(enabled = true) {
  return render(
    <WalletPortfolioSpotlight enabled={enabled}>
      <button type="button">More</button>
    </WalletPortfolioSpotlight>,
  );
}

describe('WalletPortfolioSpotlight eligibility', () => {
  beforeEach(() => {
    mockIsFocused = true;
    mockIsAppVisible = true;
    mockIsNative = false;
    mockPortfolioSyncUiState = { visible: true, disabled: false };
    mockDeviceStage = { step: 'off' };
    mockRootState = { index: 0, routes: [{ name: ERootRoutes.Main }] };
    mockRouterListeners.clear();
    mockVisibilityListeners.clear();
  });

  afterEach(cleanup);

  it.each([true, false])(
    'opts into anchor-end alignment only on native platforms: native=%s',
    (isNative) => {
      mockIsNative = isNative;
      renderSpotlight();

      expect(
        screen
          .getByTestId('portfolio-spotlight')
          .getAttribute('data-align-card-to-anchor-end'),
      ).toBe(String(isNative));
    },
  );

  it('guides an eligible account with an available Portfolio action', () => {
    renderSpotlight();

    const spotlight = screen.getByTestId('portfolio-spotlight');
    expect(spotlight.getAttribute('data-tour')).toBe(
      ESpotlightTour.portfolioMoreMenu,
    );
    expect(spotlight.getAttribute('data-backdrop-dismissible')).toBe('true');
    expect(spotlight.getAttribute('data-confirm-text')).toBe(
      ETranslations.global_got_it,
    );
    expect(spotlight.getAttribute('data-defer-until-idle')).toBe('true');
    expect(spotlight.getAttribute('data-require-visible-anchor')).toBe('true');
    expect(spotlight.getAttribute('data-delay-ms')).toBe('600');
    expect(spotlight.getAttribute('data-card-padding')).toBe('24');
    expect(spotlight.getAttribute('data-card-padding-bottom')).toBe('20');
    expect(spotlight.getAttribute('data-card-gap')).toBe('16');
    expect(spotlight.getAttribute('data-card-max-width')).toBe('280');
    expect(
      spotlight.getAttribute('data-confirm-button-padding-horizontal'),
    ).toBe('14');
    expect(spotlight.getAttribute('data-card-border-radius')).toBe('24');
    expect(spotlight.getAttribute('data-highlight-border-radius')).toBe('24');
    expect(spotlight.getAttribute('data-confirm-button-border-radius')).toBe(
      '$full',
    );
    expect(spotlight.getAttribute('data-illustration-gap')).toBe('4');
    expect(spotlight.getAttribute('data-message')).toBe(
      ETranslations.portfolio_spotlight__desc,
    );
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
    expect(screen.getByTestId('portfolio-spotlight-illustration')).toBeTruthy();
  });

  it('stays hidden when the account is ineligible, including software wallets', () => {
    mockPortfolioSyncUiState.visible = false;
    renderSpotlight();

    expect(screen.queryByTestId('portfolio-spotlight')).toBeNull();
    expect(screen.queryByTestId('portfolio-spotlight-illustration')).toBeNull();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
  });

  it('waits while the Portfolio action is disabled', () => {
    mockPortfolioSyncUiState.disabled = true;
    renderSpotlight();

    expect(screen.queryByTestId('portfolio-spotlight')).toBeNull();
  });

  it('stays hidden outside the Portfolio tab', () => {
    renderSpotlight(false);

    expect(screen.queryByTestId('portfolio-spotlight')).toBeNull();
  });

  it('stays hidden while the route is unfocused', () => {
    mockIsFocused = false;
    renderSpotlight();

    expect(screen.queryByTestId('portfolio-spotlight')).toBeNull();
  });

  it('waits when mounted in the background and resumes on foreground', () => {
    mockIsAppVisible = false;
    renderSpotlight();
    expect(screen.queryByTestId('portfolio-spotlight')).toBeNull();

    act(() => {
      mockVisibilityListeners.forEach((listener) => listener(true));
    });
    expect(screen.getByTestId('portfolio-spotlight')).toBeTruthy();
  });

  it('pauses without marking read when the app moves to the background', () => {
    renderSpotlight();
    act(() => {
      mockVisibilityListeners.forEach((listener) => listener(false));
    });
    expect(screen.queryByTestId('portfolio-spotlight')).toBeNull();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
  });

  it('waits when mounted beneath a root modal and resumes when it closes', () => {
    mockRootState = {
      index: 1,
      routes: [{ name: ERootRoutes.Main }, { name: ERootRoutes.Modal }],
    };
    renderSpotlight();

    expect(screen.queryByTestId('portfolio-spotlight')).toBeNull();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();

    navigateRoot(ERootRoutes.Main);
    expect(screen.getByTestId('portfolio-spotlight')).toBeTruthy();
  });

  it('pauses an existing guide when a root modal opens and resumes after it closes', () => {
    renderSpotlight();
    expect(screen.getByTestId('portfolio-spotlight')).toBeTruthy();

    navigateRoot(ERootRoutes.Modal);
    expect(screen.queryByTestId('portfolio-spotlight')).toBeNull();

    navigateRoot(ERootRoutes.Main);
    expect(screen.getByTestId('portfolio-spotlight')).toBeTruthy();
  });

  it.each(['connecting', 'confirm', 'done'])(
    'waits while Device Stage is %s',
    (step) => {
      mockDeviceStage = { step };
      const view = renderSpotlight();

      expect(screen.queryByTestId('portfolio-spotlight')).toBeNull();

      mockDeviceStage = { step: 'off' };
      view.rerender(
        <WalletPortfolioSpotlight enabled>
          <button type="button">More</button>
        </WalletPortfolioSpotlight>,
      );
      expect(screen.getByTestId('portfolio-spotlight')).toBeTruthy();
    },
  );

  it('keeps waiting when the modal closes but Device Stage is still active', () => {
    mockDeviceStage = { step: 'connecting' };
    mockRootState = { index: 0, routes: [{ name: ERootRoutes.Modal }] };
    const view = renderSpotlight();

    navigateRoot(ERootRoutes.Main);
    expect(screen.queryByTestId('portfolio-spotlight')).toBeNull();

    mockDeviceStage = { step: 'off' };
    view.rerender(
      <WalletPortfolioSpotlight enabled>
        <button type="button">More</button>
      </WalletPortfolioSpotlight>,
    );
    expect(screen.getByTestId('portfolio-spotlight')).toBeTruthy();
  });
});
