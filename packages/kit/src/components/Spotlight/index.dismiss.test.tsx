/** @jest-environment jsdom */

import type { MouseEventHandler, ReactElement, ReactNode } from 'react';

import { Spotlight, SpotlightView } from '.';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';

import { acquireDeferredGuideBlocker } from '@onekeyhq/components/src/hooks/useDeferredGuideBlocker';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

let mockTourTimes = 0;
let mockGtMd = true;
let mockAnchorX = 20;
let mockAnchorY = 40;
let mockAnchorWidth = 80;
let mockWindowDimensions = { width: 1024, height: 768 };
let mockSafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };
let mockDesktopPlatform: 'mac' | 'windows' | 'linux' = 'mac';
let mockMeasureCount = 0;
let mockMeasureCallbacks:
  | ((x: number, y: number, width: number, height: number) => void)[]
  | undefined;

jest.mock('react-native', () => ({
  useWindowDimensions: () => mockWindowDimensions,
}));
const mockUpdateTourTimes = jest
  .fn<Promise<void>, [unknown]>()
  .mockResolvedValue(undefined);
const blockerReleases: (() => void)[] = [];

function blockGuides() {
  const release = acquireDeferredGuideBlocker();
  blockerReleases.push(release);
  return release;
}

async function advanceTime(milliseconds: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDev: false,
    get isDesktopWin() {
      return mockDesktopPlatform === 'windows';
    },
    get isDesktopLinux() {
      return mockDesktopPlatform === 'linux';
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  useAppIsLockedAtom: () => [false],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/spotlight', () => ({
  useSpotlightPersistAtom: () => [
    { data: { [ESpotlightTour.allNetworksInfo]: mockTourTimes } },
  ],
}));

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSpotlight: {
      updateTourTimes: (params: unknown) => mockUpdateTourTimes(params),
    },
  },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const deferredGuideHooks = jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredGuideBlocker')
  >('../../../../components/src/hooks/useDeferredGuideBlocker');
  const media = {
    get gtMd() {
      return mockGtMd;
    },
  };
  type IBoxProps = {
    children?: ReactNode;
    onPress?: MouseEventHandler<HTMLElement>;
    testID?: string;
    width?: number;
    height?: number;
    top?: number;
    left?: number | string;
    right?: number | string;
    maxWidth?: number;
    px?: number | string;
    py?: number | string;
    pb?: number | string;
    gap?: number | string;
    borderRadius?: number | string;
  };
  const Box = ({
    children,
    onPress,
    testID,
    width,
    height,
    top,
    left,
    right,
    maxWidth,
    px,
    py,
    pb,
    gap,
    borderRadius,
  }: IBoxProps) =>
    React.createElement(
      'div',
      {
        onClick: onPress,
        'data-testid': testID,
        'data-width': width,
        'data-height': height,
        'data-top': top,
        'data-left': left,
        'data-right': right,
        'data-max-width': maxWidth,
        'data-padding-x': px,
        'data-padding-y': py,
        'data-padding-bottom': pb,
        'data-gap': gap,
        'data-border-radius': borderRadius,
      },
      children,
    );
  const View = React.forwardRef<
    {
      measureInWindow: (
        callback: (x: number, y: number, width: number, height: number) => void,
      ) => void;
    },
    IBoxProps
  >((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      measureInWindow: (callback) => {
        mockMeasureCount += 1;
        if (mockMeasureCallbacks) mockMeasureCallbacks.push(callback);
        else callback(mockAnchorX, mockAnchorY, mockAnchorWidth, 48);
      },
    }));
    return React.createElement(Box, props);
  });
  View.displayName = 'SpotlightTestView';

  return {
    ...deferredGuideHooks,
    Button: ({ children, onPress, testID, borderRadius, px }: IBoxProps) =>
      React.createElement(
        'button',
        {
          onClick: onPress,
          'data-testid': testID,
          'data-border-radius': borderRadius,
          'data-padding-x': px,
        },
        children,
      ),
    EPortalContainerConstantName: { SPOTLIGHT_OVERLAY_PORTAL: 'spotlight' },
    Portal: {
      Body: ({
        children,
        destroyDelayMs,
      }: IBoxProps & { destroyDelayMs?: number }) =>
        React.createElement(
          'div',
          {
            'data-testid': 'spotlight-portal',
            'data-destroy-delay': destroyDelayMs,
          },
          children,
        ),
    },
    SizableText: Box,
    Stack: View,
    View,
    XStack: Box,
    YStack: Box,
    useBackHandler: jest.fn(),
    useDeferredPromise: () =>
      React.useMemo(
        () => ({ promise: Promise.resolve(), resolve: jest.fn() }),
        [],
      ),
    useMedia: () => media,
    useSafeAreaInsets: () => mockSafeAreaInsets,
    getTokenValue: (token: string) => (token === '$2' ? 8 : 16),
  };
});

function renderView(closeOnBackdropPress?: boolean, confirmText?: string) {
  const onConfirm = jest.fn();
  render(
    <SpotlightView
      visible
      closeOnBackdropPress={closeOnBackdropPress}
      confirmText={confirmText}
      content={<span>Update device portfolio here</span>}
      onConfirm={onConfirm}
    >
      <span>More</span>
    </SpotlightView>,
  );
  return onConfirm;
}

function renderDelayedTour(
  deferUntilIdle = true,
  illustration?: ReactElement,
  requireVisibleAnchor = false,
) {
  return render(
    <Spotlight
      isVisible
      delayMs={600}
      deferUntilIdle={deferUntilIdle}
      requireVisibleAnchor={requireVisibleAnchor}
      closeOnBackdropPress
      confirmText="Got it"
      tourName={ESpotlightTour.allNetworksInfo}
      message="Update device portfolio here"
      illustration={illustration}
    >
      <span>More</span>
    </Spotlight>,
  );
}

function getCard() {
  return screen.getByTestId('spotlight-card');
}

describe('Spotlight dismissal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockTourTimes = 0;
    mockGtMd = true;
    mockAnchorX = 20;
    mockAnchorY = 40;
    mockAnchorWidth = 80;
    mockWindowDimensions = { width: 1024, height: 768 };
    mockSafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };
    mockDesktopPlatform = 'mac';
    mockMeasureCount = 0;
    mockMeasureCallbacks = undefined;
  });

  afterEach(() => {
    cleanup();
    blockerReleases.splice(0).forEach((release) => release());
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('keeps existing tours open when the backdrop option is omitted', () => {
    const onConfirm = renderView();

    fireEvent.click(screen.getByTestId('spotlight-backdrop'));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('spotlight-content')).toBeTruthy();
  });

  it.each([
    { platform: 'windows' as const, highlightTop: 2, cardTop: 78 },
    { platform: 'linux' as const, highlightTop: 2, cardTop: 78 },
    { platform: 'mac' as const, highlightTop: 32, cardTop: 108 },
  ])(
    'stabilizes measurement without shifting the $platform coordinates',
    async ({ platform, highlightTop, cardTop }) => {
      mockDesktopPlatform = platform;
      mockMeasureCallbacks = [];
      renderView();

      // Bound the callback drain so a regression fails instead of hanging Jest.
      for (let index = 0; index < 6; index += 1) {
        const callback = mockMeasureCallbacks.shift();
        if (!callback) break;
        await act(async () => callback(20, 40, 80, 48));
      }

      expect(mockMeasureCallbacks).toHaveLength(0);
      expect(mockMeasureCount).toBe(2);
      expect(
        screen.getByTestId('spotlight-highlight').getAttribute('data-top'),
      ).toBe(String(highlightTop));
      expect(
        screen.getByTestId('spotlight-card').getAttribute('data-top'),
      ).toBe(String(cardTop));

      await advanceTime(1000);
      expect(mockMeasureCount).toBe(2);
      expect(mockMeasureCallbacks).toHaveLength(0);
    },
  );

  it('confirms an opted-in tour when its backdrop is pressed', () => {
    const onConfirm = renderView(true);

    fireEvent.click(screen.getByTestId('spotlight-backdrop'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss an opted-in tour when its content is pressed', () => {
    const onConfirm = renderView(true);

    fireEvent.click(screen.getByText('Update device portfolio here'));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('matches the measured trigger and padding only when explicitly enabled', async () => {
    const renderSizedView = (matchTriggerSize?: boolean) => (
      <SpotlightView
        visible
        matchTriggerSize={matchTriggerSize}
        childrenPaddingHorizontal={12}
        childrenPaddingVertical={6}
        content={<span>Update device portfolio here</span>}
      >
        <span>More</span>
      </SpotlightView>
    );
    const view = render(renderSizedView());
    const highlightedTrigger = () =>
      within(screen.getByTestId('spotlight-content')).getByText('More')
        .parentElement;

    expect(highlightedTrigger()?.hasAttribute('data-width')).toBe(false);
    expect(highlightedTrigger()?.hasAttribute('data-height')).toBe(false);

    view.rerender(renderSizedView(true));
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });

    expect(highlightedTrigger()?.getAttribute('data-width')).toBe('104');
    expect(highlightedTrigger()?.getAttribute('data-height')).toBe('60');
  });

  it.each([false, true])(
    'keeps Done available when backdrop dismissal is %s',
    (closeOnBackdropPress) => {
      const onConfirm = renderView(closeOnBackdropPress);

      expect(screen.getByTestId('spotlight-btn').textContent).toBe(
        ETranslations.global_done,
      );
      fireEvent.click(screen.getByTestId('spotlight-btn'));

      expect(onConfirm).toHaveBeenCalledTimes(1);
    },
  );

  it('uses Got it when the tour supplies its own confirmation text', () => {
    const onConfirm = renderView(true, 'Got it');

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders an optional illustration before the existing message without dismissing the tour', async () => {
    renderDelayedTour(
      true,
      <div data-testid="portfolio-spotlight-illustration" />,
    );
    await advanceTime(600);

    const illustration = screen.getByTestId('portfolio-spotlight-illustration');
    const message = screen.getByText('Update device portfolio here');
    expect(illustration.parentElement?.getAttribute('data-gap')).toBe('$3');
    expect(illustration.compareDocumentPosition(message)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();

    fireEvent.click(illustration);
    expect(screen.getByTestId('spotlight-content')).toBeTruthy();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it('preserves text-only tours when no illustration is supplied', async () => {
    renderDelayedTour();
    await advanceTime(600);

    expect(screen.getByText('Update device portfolio here')).toBeTruthy();
    expect(screen.queryByTestId('portfolio-spotlight-illustration')).toBeNull();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
    expect(getCard().getAttribute('data-padding-x')).toBe('$4');
    expect(getCard().getAttribute('data-padding-y')).toBe('$3.5');
    expect(getCard().getAttribute('data-padding-bottom')).toBe('$3.5');
    expect(getCard().getAttribute('data-gap')).toBe('$3.5');
    expect(getCard().getAttribute('data-max-width')).toBe('354');
    expect(getCard().getAttribute('data-border-radius')).toBe('$3');
    expect(
      screen
        .getByTestId('spotlight-highlight')
        .getAttribute('data-border-radius'),
    ).toBe('$3');
    expect(
      screen.getByTestId('spotlight-btn').getAttribute('data-border-radius'),
    ).toBe('$2');
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it('applies optional card spacing through Spotlight without changing the text or dismissal', async () => {
    render(
      <Spotlight
        isVisible
        cardPadding={24}
        cardPaddingBottom={20}
        cardGap={16}
        cardMaxWidth={280}
        tourName={ESpotlightTour.allNetworksInfo}
        message="Update device portfolio here"
      >
        <span>More</span>
      </Spotlight>,
    );
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });

    expect(getCard().getAttribute('data-padding-x')).toBe('24');
    expect(getCard().getAttribute('data-padding-y')).toBe('24');
    expect(getCard().getAttribute('data-padding-bottom')).toBe('20');
    expect(getCard().getAttribute('data-gap')).toBe('16');
    expect(getCard().getAttribute('data-max-width')).toBe('280');
    expect(screen.getByText('Update device portfolio here')).toBeTruthy();
    fireEvent.click(screen.getByTestId('spotlight-btn'));
    expect(mockUpdateTourTimes).toHaveBeenCalledTimes(1);
  });

  it('updates optional view spacing after mount and restores the original defaults', async () => {
    const renderSpacedView = (
      cardPadding?: number,
      cardGap?: number,
      cardPaddingBottom?: number,
    ) => (
      <SpotlightView
        visible
        cardPadding={cardPadding}
        cardPaddingBottom={cardPaddingBottom}
        cardGap={cardGap}
        content={<span>Update device portfolio here</span>}
      >
        <span>More</span>
      </SpotlightView>
    );
    const view = render(renderSpacedView());
    expect(getCard().getAttribute('data-padding-x')).toBe('$4');
    expect(getCard().getAttribute('data-padding-y')).toBe('$3.5');
    expect(getCard().getAttribute('data-padding-bottom')).toBe('$3.5');
    expect(getCard().getAttribute('data-gap')).toBe('$3.5');

    view.rerender(renderSpacedView(24, 16, 20));
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
    expect(getCard().getAttribute('data-padding-x')).toBe('24');
    expect(getCard().getAttribute('data-padding-y')).toBe('24');
    expect(getCard().getAttribute('data-padding-bottom')).toBe('20');
    expect(getCard().getAttribute('data-gap')).toBe('16');

    view.rerender(renderSpacedView(24, 16));
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
    expect(getCard().getAttribute('data-padding-bottom')).toBe('24');

    view.rerender(renderSpacedView());
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
    expect(getCard().getAttribute('data-padding-x')).toBe('$4');
    expect(getCard().getAttribute('data-padding-y')).toBe('$3.5');
    expect(getCard().getAttribute('data-padding-bottom')).toBe('$3.5');
    expect(getCard().getAttribute('data-gap')).toBe('$3.5');
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it('updates optional card radius and illustration spacing and restores their defaults when removed', async () => {
    const renderIllustratedTour = (
      cardBorderRadius?: number,
      illustrationGap?: number,
    ) => (
      <Spotlight
        isVisible
        cardBorderRadius={cardBorderRadius}
        illustrationGap={illustrationGap}
        illustration={<div data-testid="portfolio-spotlight-illustration" />}
        tourName={ESpotlightTour.allNetworksInfo}
        message="Update device portfolio here"
      >
        <span>More</span>
      </Spotlight>
    );
    const view = render(renderIllustratedTour());
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
    expect(getCard().getAttribute('data-border-radius')).toBe('$3');
    expect(
      screen
        .getByTestId('portfolio-spotlight-illustration')
        .parentElement?.getAttribute('data-gap'),
    ).toBe('$3');

    view.rerender(renderIllustratedTour(24, 4));
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
    expect(getCard().getAttribute('data-border-radius')).toBe('24');
    expect(
      screen
        .getByTestId('portfolio-spotlight-illustration')
        .parentElement?.getAttribute('data-gap'),
    ).toBe('4');

    view.rerender(renderIllustratedTour());
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
    expect(getCard().getAttribute('data-border-radius')).toBe('$3');
    expect(
      screen
        .getByTestId('portfolio-spotlight-illustration')
        .parentElement?.getAttribute('data-gap'),
    ).toBe('$3');
    expect(screen.getByText('Update device portfolio here')).toBeTruthy();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it('updates optional highlight and confirmation button radii and restores their original defaults', async () => {
    const renderRoundedTour = (
      highlightBorderRadius?: number,
      confirmButtonBorderRadius?: '$full',
    ) => (
      <Spotlight
        isVisible
        highlightBorderRadius={highlightBorderRadius}
        confirmButtonBorderRadius={confirmButtonBorderRadius}
        tourName={ESpotlightTour.allNetworksInfo}
        message="Update device portfolio here"
      >
        <span>More</span>
      </Spotlight>
    );
    const view = render(renderRoundedTour());
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
    expect(
      screen
        .getByTestId('spotlight-highlight')
        .getAttribute('data-border-radius'),
    ).toBe('$3');
    expect(
      screen.getByTestId('spotlight-btn').getAttribute('data-border-radius'),
    ).toBe('$2');

    view.rerender(renderRoundedTour(24, '$full'));
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
    expect(
      screen
        .getByTestId('spotlight-highlight')
        .getAttribute('data-border-radius'),
    ).toBe('24');
    expect(
      screen.getByTestId('spotlight-btn').getAttribute('data-border-radius'),
    ).toBe('$full');

    view.rerender(renderRoundedTour());
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
    expect(
      screen
        .getByTestId('spotlight-highlight')
        .getAttribute('data-border-radius'),
    ).toBe('$3');
    expect(
      screen.getByTestId('spotlight-btn').getAttribute('data-border-radius'),
    ).toBe('$2');
    expect(getCard().getAttribute('data-border-radius')).toBe('$3');
    expect(screen.getByText('Update device portfolio here')).toBeTruthy();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it('applies optional confirmation padding and restores the Button default when removed', async () => {
    const renderPaddedTour = (confirmButtonPaddingHorizontal?: number) => (
      <Spotlight
        isVisible
        confirmButtonPaddingHorizontal={confirmButtonPaddingHorizontal}
        tourName={ESpotlightTour.allNetworksInfo}
        message="Update device portfolio here"
      >
        <span>More</span>
      </Spotlight>
    );
    const view = render(renderPaddedTour());
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
    expect(
      screen.getByTestId('spotlight-btn').hasAttribute('data-padding-x'),
    ).toBe(false);

    view.rerender(renderPaddedTour(14));
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
    expect(
      screen.getByTestId('spotlight-btn').getAttribute('data-padding-x'),
    ).toBe('14');

    view.rerender(renderPaddedTour());
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
    expect(
      screen.getByTestId('spotlight-btn').hasAttribute('data-padding-x'),
    ).toBe(false);
    expect(
      screen.getByTestId('spotlight-btn').getAttribute('data-border-radius'),
    ).toBe('$2');
    expect(screen.getByText('Update device portfolio here')).toBeTruthy();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it.each([
    ['desktop', true, '354'],
    ['mobile', false, null],
  ] as const)(
    'updates optional card width on %s and restores its original default when removed',
    async (_platform, gtMd, defaultMaxWidth) => {
      mockGtMd = gtMd;
      const renderWidthView = (cardMaxWidth?: number) => (
        <SpotlightView
          visible
          cardMaxWidth={cardMaxWidth}
          content={<span>Update device portfolio here</span>}
        >
          <span>More</span>
        </SpotlightView>
      );
      const view = render(renderWidthView());
      expect(getCard().getAttribute('data-max-width')).toBe(defaultMaxWidth);

      view.rerender(renderWidthView(280));
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });
      expect(getCard().getAttribute('data-max-width')).toBe('280');

      view.rerender(renderWidthView());
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });
      expect(getCard().getAttribute('data-max-width')).toBe(defaultMaxWidth);
      expect(getCard().getAttribute('data-padding-x')).toBe('$4');
      expect(getCard().getAttribute('data-padding-y')).toBe('$3.5');
      expect(getCard().getAttribute('data-gap')).toBe('$3.5');
      expect(screen.getByText('Update device portfolio here')).toBeTruthy();
      expect(mockUpdateTourTimes).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['desktop', true, '12', null],
    ['mobile', false, '$4', '$4'],
  ] as const)(
    'preserves the default %s card placement without anchor-end alignment',
    (_platform, gtMd, left, right) => {
      mockGtMd = gtMd;
      render(
        <SpotlightView
          visible
          cardMaxWidth={280}
          content={<span>Update device portfolio here</span>}
        >
          <span>More</span>
        </SpotlightView>,
      );

      expect(getCard().getAttribute('data-left')).toBe(left);
      expect(getCard().getAttribute('data-right')).toBe(right);
      expect(getCard().hasAttribute('data-width')).toBe(false);
      expect(getCard().getAttribute('data-max-width')).toBe('280');
    },
  );

  it('aligns an opted-in tour card with the highlighted trigger right edge', async () => {
    mockGtMd = false;
    mockWindowDimensions = { width: 390, height: 844 };
    mockAnchorX = 300;
    mockAnchorWidth = 74;
    render(
      <Spotlight
        isVisible
        alignCardToAnchorEnd
        matchTriggerSize
        cardMaxWidth={280}
        tourName={ESpotlightTour.allNetworksInfo}
        message="Update device portfolio here"
      >
        <span>More</span>
      </Spotlight>,
    );
    await advanceTime(0);

    const highlight = screen.getByTestId('spotlight-highlight');
    const highlightRight =
      Number(highlight.getAttribute('data-left')) +
      Number(highlight.getAttribute('data-width'));
    const cardRight =
      Number(getCard().getAttribute('data-left')) +
      Number(getCard().getAttribute('data-width'));

    expect(getCard().getAttribute('data-left')).toBe('102');
    expect(getCard().getAttribute('data-width')).toBe('280');
    expect(cardRight).toBe(highlightRight);
    expect(getCard().hasAttribute('data-right')).toBe(false);
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'left-side anchor',
      windowWidth: 390,
      anchorX: 20,
      leftInset: 0,
      rightInset: 0,
      left: 8,
      width: 280,
    },
    {
      name: 'right-side overflow',
      windowWidth: 390,
      anchorX: 360,
      leftInset: 0,
      rightInset: 0,
      left: 102,
      width: 280,
    },
    {
      name: 'narrow viewport',
      windowWidth: 260,
      anchorX: 170,
      leftInset: 0,
      rightInset: 0,
      left: 8,
      width: 244,
    },
    {
      name: 'landscape right safe area',
      windowWidth: 844,
      anchorX: 700,
      leftInset: 59,
      rightInset: 59,
      left: 497,
      width: 280,
    },
    {
      name: 'landscape left safe area',
      windowWidth: 844,
      anchorX: 20,
      leftInset: 59,
      rightInset: 59,
      left: 67,
      width: 280,
    },
  ])(
    'keeps anchor-end alignment within the $name bounds',
    ({ windowWidth, anchorX, leftInset, rightInset, left, width }) => {
      mockGtMd = false;
      mockWindowDimensions = { width: windowWidth, height: 844 };
      mockAnchorX = anchorX;
      mockAnchorWidth = 74;
      mockSafeAreaInsets = {
        top: 0,
        bottom: 0,
        left: leftInset,
        right: rightInset,
      };
      render(
        <SpotlightView
          visible
          alignCardToAnchorEnd
          cardMaxWidth={280}
          content={<span>Update device portfolio here</span>}
        >
          <span>More</span>
        </SpotlightView>,
      );

      expect(getCard().getAttribute('data-left')).toBe(String(left));
      expect(getCard().getAttribute('data-width')).toBe(String(width));
      expect(left).toBeGreaterThanOrEqual(leftInset + 8);
      expect(left + width).toBeLessThanOrEqual(windowWidth - rightInset - 8);
    },
  );

  it('remeasures anchor-end placement when window dimensions change', async () => {
    mockGtMd = false;
    mockWindowDimensions = { width: 390, height: 844 };
    mockAnchorX = 300;
    mockAnchorWidth = 74;
    const renderAlignedView = () => (
      <SpotlightView
        visible
        alignCardToAnchorEnd
        cardMaxWidth={280}
        content={<span>Update device portfolio here</span>}
      >
        <span>More</span>
      </SpotlightView>
    );
    const view = render(renderAlignedView());
    await advanceTime(0);
    expect(getCard().getAttribute('data-left')).toBe('102');

    mockWindowDimensions = { width: 844, height: 390 };
    mockAnchorX = 600;
    mockSafeAreaInsets = { top: 0, bottom: 0, left: 59, right: 59 };
    view.rerender(renderAlignedView());
    await advanceTime(0);

    expect(getCard().getAttribute('data-left')).toBe('402');
    expect(getCard().getAttribute('data-width')).toBe('280');
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it('updates anchor-end alignment and restores default placement when removed', async () => {
    mockGtMd = false;
    mockWindowDimensions = { width: 390, height: 844 };
    mockAnchorX = 300;
    mockAnchorWidth = 74;
    const renderAlignedView = (alignCardToAnchorEnd?: boolean) => (
      <SpotlightView
        visible
        alignCardToAnchorEnd={alignCardToAnchorEnd}
        cardMaxWidth={280}
        content={<span>Update device portfolio here</span>}
      >
        <span>More</span>
      </SpotlightView>
    );
    const view = render(renderAlignedView());
    expect(getCard().getAttribute('data-left')).toBe('$4');
    expect(getCard().getAttribute('data-right')).toBe('$4');

    view.rerender(renderAlignedView(true));
    await advanceTime(0);
    expect(getCard().getAttribute('data-left')).toBe('102');
    expect(getCard().getAttribute('data-width')).toBe('280');
    expect(getCard().hasAttribute('data-right')).toBe(false);

    view.rerender(renderAlignedView());
    await advanceTime(0);
    expect(getCard().getAttribute('data-left')).toBe('$4');
    expect(getCard().getAttribute('data-right')).toBe('$4');
    expect(getCard().hasAttribute('data-width')).toBe(false);
  });

  it('records a backdrop dismissal as visited and stays hidden on the next visit', async () => {
    const renderTour = () => (
      <Spotlight
        isVisible
        closeOnBackdropPress
        confirmText="Got it"
        tourName={ESpotlightTour.allNetworksInfo}
        message="Update device portfolio here"
      >
        <span>More</span>
      </Spotlight>
    );
    const view = render(renderTour());
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });

    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('spotlight-backdrop'));

    expect(mockUpdateTourTimes).toHaveBeenCalledTimes(1);
    expect(mockUpdateTourTimes).toHaveBeenCalledWith({
      tourName: ESpotlightTour.allNetworksInfo,
      manualTimes: undefined,
    });

    mockTourTimes = 1;
    view.rerender(renderTour());
    expect(screen.queryByTestId('spotlight-content')).toBeNull();
    view.unmount();

    render(renderTour());
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
    expect(screen.queryByTestId('spotlight-content')).toBeNull();
  });

  it('waits for an initial blocker and a full idle delay without marking the tour visited', async () => {
    const release = blockGuides();
    renderDelayedTour();

    await advanceTime(2000);
    expect(screen.queryByTestId('spotlight-content')).toBeNull();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();

    act(release);
    await advanceTime(599);
    expect(screen.queryByTestId('spotlight-content')).toBeNull();

    await advanceTime(1);
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('spotlight-portal').getAttribute('data-destroy-delay'),
    ).toBe('0');
  });

  it('restarts the entire idle delay when interrupted before appearing', async () => {
    renderDelayedTour();
    await advanceTime(300);
    let release: () => void = () => undefined;
    act(() => {
      release = blockGuides();
    });

    await advanceTime(1000);
    expect(screen.queryByTestId('spotlight-content')).toBeNull();

    act(release);
    await advanceTime(599);
    expect(screen.queryByTestId('spotlight-content')).toBeNull();

    await advanceTime(1);
    expect(screen.getByTestId('spotlight-content')).toBeTruthy();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it('immediately hides a displayed guide and resumes after a fresh idle delay without marking it visited', async () => {
    renderDelayedTour();
    await advanceTime(600);
    expect(screen.getByTestId('spotlight-content')).toBeTruthy();
    let release: () => void = () => undefined;
    act(() => {
      release = blockGuides();
    });

    expect(screen.queryByTestId('spotlight-content')).toBeNull();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
    await advanceTime(100);

    act(release);
    await advanceTime(599);
    expect(screen.queryByTestId('spotlight-content')).toBeNull();

    await advanceTime(1);
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(mockUpdateTourTimes).toHaveBeenCalledTimes(1);
  });

  it('still restarts the idle delay when a displayed guide is interrupted only briefly', async () => {
    renderDelayedTour();
    await advanceTime(600);
    let release: () => void = () => undefined;
    act(() => {
      release = blockGuides();
    });
    expect(screen.queryByTestId('spotlight-content')).toBeNull();

    act(release);
    expect(screen.queryByTestId('spotlight-content')).toBeNull();
    await advanceTime(599);
    expect(screen.queryByTestId('spotlight-content')).toBeNull();

    await advanceTime(1);
    expect(screen.getByTestId('spotlight-content')).toBeTruthy();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it('leaves existing tours unchanged when they do not opt into idle deferral', async () => {
    const release = blockGuides();
    renderDelayedTour(false);

    await advanceTime(600);
    expect(screen.getByTestId('spotlight-content')).toBeTruthy();
    expect(
      screen.getByTestId('spotlight-portal').getAttribute('data-destroy-delay'),
    ).toBe('1200');

    act(release);
    act(() => {
      blockGuides();
    });
    expect(screen.getByTestId('spotlight-content')).toBeTruthy();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it('waits for an off-screen anchor and starts a fresh delay when it returns', async () => {
    mockAnchorY = -80;
    renderDelayedTour(true, undefined, true);
    await advanceTime(1000);
    expect(screen.queryByTestId('spotlight-content')).toBeNull();

    mockAnchorY = 40;
    fireEvent.scroll(document);
    await advanceTime(150);
    await advanceTime(599);
    expect(screen.queryByTestId('spotlight-content')).toBeNull();
    await advanceTime(1);
    expect(screen.getByTestId('spotlight-content')).toBeTruthy();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it('rechecks the anchor at the end of the delay rather than using a stale measurement', async () => {
    renderDelayedTour(true, undefined, true);
    await advanceTime(300);
    mockAnchorY = 800;
    await advanceTime(300);

    expect(screen.queryByTestId('spotlight-content')).toBeNull();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it('pauses an active guide during scrolling without marking it read', async () => {
    renderDelayedTour(true, undefined, true);
    await advanceTime(600);
    expect(screen.getByTestId('spotlight-content')).toBeTruthy();
    fireEvent.scroll(document);
    expect(screen.queryByTestId('spotlight-content')).toBeNull();

    await advanceTime(150);
    await advanceTime(599);
    expect(screen.queryByTestId('spotlight-content')).toBeNull();
    await advanceTime(1);
    expect(screen.getByTestId('spotlight-content')).toBeTruthy();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it('does not enable the new viewport gate on existing tours', async () => {
    mockAnchorY = -80;
    renderDelayedTour(false);
    await advanceTime(600);
    expect(screen.getByTestId('spotlight-content')).toBeTruthy();
  });

  it('ignores a delayed native measurement after the guide becomes ineligible', async () => {
    const content = (isVisible: boolean) => (
      <Spotlight
        isVisible={isVisible}
        delayMs={600}
        deferUntilIdle
        requireVisibleAnchor
        tourName={ESpotlightTour.allNetworksInfo}
        message="Portfolio guide"
      >
        <span>More</span>
      </Spotlight>
    );
    const view = render(content(true));
    mockMeasureCallbacks = [];
    await advanceTime(600);
    const pendingMeasurements = mockMeasureCallbacks;
    expect(pendingMeasurements.length).toBeGreaterThan(0);

    view.rerender(content(false));
    act(() => {
      pendingMeasurements.forEach((callback) => callback(20, 40, 80, 48));
    });
    await advanceTime(1000);

    expect(screen.queryByTestId('spotlight-content')).toBeNull();
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });

  it('waits for a legacy spotlight to close without either tour blocking itself', async () => {
    const renderGuides = (legacyVisible: boolean) => (
      <>
        <SpotlightView
          visible={legacyVisible}
          content={<span>Existing tour</span>}
        >
          <span>Existing target</span>
        </SpotlightView>
        <Spotlight
          isVisible
          delayMs={600}
          deferUntilIdle
          tourName={ESpotlightTour.allNetworksInfo}
          message="Portfolio guide"
        >
          <span>More</span>
        </Spotlight>
      </>
    );
    const view = render(renderGuides(true));
    await advanceTime(1000);

    expect(screen.getByText('Existing tour')).toBeTruthy();
    expect(screen.queryByText('Portfolio guide')).toBeNull();

    view.rerender(renderGuides(false));
    await advanceTime(599);
    expect(screen.queryByText('Existing tour')).toBeNull();
    expect(screen.queryByText('Portfolio guide')).toBeNull();

    await advanceTime(1);
    expect(screen.getByText('Portfolio guide')).toBeTruthy();
    expect(screen.getAllByTestId('spotlight-content')).toHaveLength(1);
    expect(mockUpdateTourTimes).not.toHaveBeenCalled();
  });
});
