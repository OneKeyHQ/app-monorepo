/** @jest-environment jsdom */

import type { ReactNode, Ref } from 'react';
import { useEffect } from 'react';

import { ok as assert } from 'node:assert/strict';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { openWebView } from '../../../WebView/utils/webViewNavigation';

import { SupportHub } from './SupportHub';

type IPageScrollState = 'idle' | 'dragging' | 'settling';

let mockIsNative = true;
let mockFocused = true;

let mockPageScrollStateChanged: (event: {
  nativeEvent: { pageScrollState: IPageScrollState };
}) => void;

jest.mock('@onekeyhq/components', () => ({
  ...jest.requireActual<
    typeof import('../../../../../../components/src/composite/Carousel')
  >('../../../../../../components/src/composite/Carousel'),
  ...jest.requireMock<Record<string, unknown>>(
    '../../../../../../components/src/primitives',
  ),
  // Jest maps components subpaths to the same mock module.
  BannerSwiper: jest.requireActual<
    typeof import('../../../../../../components/src/composite/Banner/BannerSwiper.web')
  >('../../../../../../components/src/composite/Banner/BannerSwiper.web')
    .BannerSwiper,
  Icon: () => null,
  Image: () => null,
  Theme: ({ children }: { children?: ReactNode }) => children,
}));

jest.mock('../../../../../../components/src/primitives', () => {
  const MockStack = ({
    children,
    onPress,
    onLayout,
    ref,
    testID,
    'aria-current': ariaCurrent,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    onLayout?: (event: {
      nativeEvent: { layout: { width: number; height: number } };
    }) => void;
    ref?: Ref<HTMLDivElement>;
    testID?: string;
    'aria-current'?: 'page';
  }) => {
    useEffect(() => {
      onLayout?.({ nativeEvent: { layout: { width: 320, height: 151 } } });
    }, [onLayout]);
    return onPress ? (
      <button
        type="button"
        onClick={onPress}
        data-testid={testID}
        aria-current={ariaCurrent}
      >
        {children}
      </button>
    ) : (
      <div ref={ref} data-testid={testID}>
        {children}
      </div>
    );
  };
  return {
    Stack: MockStack,
    XStack: MockStack,
    YStack: MockStack,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
  };
});

jest.mock('../../../../../../components/src/actions/IconButton', () => ({
  IconButton: () => null,
}));

jest.mock(
  '../../../../../../components/src/composite/Carousel/PaginationItem',
  () => ({
    PaginationItem: () => null,
  }),
);

jest.mock('../../../../../../components/src/composite/Carousel/pager', () => ({
  PagerView: ({
    children,
    onPageScrollStateChanged,
  }: {
    children?: ReactNode;
    onPageScrollStateChanged: typeof mockPageScrollStateChanged;
  }) => {
    mockPageScrollStateChanged = onPageScrollStateChanged;
    return <div>{children}</div>;
  },
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
  NavigationContext: jest
    .requireActual<typeof import('react')>('react')
    .createContext(undefined),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useHelpLink', () => ({
  useHelpLink: () => 'https://help.onekey.so',
}));

jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false }],
}));

jest.mock('@onekeyhq/shared/src/config/appConfig', () => ({
  ONEKEY_URL: 'https://onekey.so',
  ONEKEY_SIFU_URL: 'https://onekey.so/sifu',
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom', () => ({
  getIntercomUnreadCount: () => 0,
  subscribeToIntercomUnreadCount: () => () => undefined,
  showIntercom: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
    get isWeb() {
      return !mockIsNative;
    },
    isExtension: false,
  },
}));

jest.mock('../../../WebView/utils/webViewNavigation', () => ({
  openWebView: jest.fn(),
}));

jest.mock('../RichBlock', () => ({
  RichBlock: ({ content }: { content?: ReactNode }) => content,
}));

describe('SupportHub banner carousel press suppression', () => {
  beforeEach(() => {
    mockIsNative = true;
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-02T00:00:00Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const setScrollState = (pageScrollState: IPageScrollState) => {
    act(() => {
      mockPageScrollStateChanged({ nativeEvent: { pageScrollState } });
    });
  };

  const pressQuizBanner = () => {
    fireEvent.click(screen.getByText(ETranslations.quiz_time__title));
  };

  it('opens the corresponding URL exactly once on a normal banner tap', () => {
    render(<SupportHub />);

    pressQuizBanner();

    expect(openWebView).toHaveBeenCalledTimes(1);
    expect(openWebView).toHaveBeenCalledWith({
      url: 'https://onekey.so/quiz-challenge?utm_source=app_support_hub',
      source: 'in-app',
    });
  });

  it.each(['idle', 'settling'] as const)(
    'blocks a swipe release through %s and allows taps after the protection window',
    (releaseState) => {
      render(<SupportHub />);

      setScrollState('dragging');
      pressQuizBanner();
      expect(openWebView).not.toHaveBeenCalled();

      // An idle release without a page change models a cancelled swipe.
      setScrollState(releaseState);
      pressQuizBanner();
      expect(openWebView).not.toHaveBeenCalled();

      if (releaseState === 'settling') {
        setScrollState('idle');
      }
      act(() => {
        jest.advanceTimersByTime(149);
      });
      pressQuizBanner();
      expect(openWebView).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1);
      });
      pressQuizBanner();
      expect(openWebView).toHaveBeenCalledTimes(1);
    },
  );
});

describe('SupportHub Web Banner integration', () => {
  beforeEach(() => {
    mockIsNative = false;
    mockFocused = true;
    jest.useFakeTimers();
    jest.clearAllMocks();
    const eventTarget: EventTarget = globalThis;
    jest
      .spyOn(eventTarget, 'addEventListener')
      .mockImplementation((...args) =>
        EventTarget.prototype.addEventListener.call(eventTarget, ...args),
      );
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      right: 320,
      top: 0,
      bottom: 151,
      width: 320,
      height: 151,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function pointer(target: EventTarget, type: string, x: number) {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: x,
      clientY: 40,
    });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    act(() => {
      target.dispatchEvent(event);
    });
  }

  function viewport() {
    const result = screen.getByTestId('support-hub-banner').firstElementChild;
    assert(result, 'Missing banner viewport');
    return result;
  }

  function activeCard() {
    const result = screen
      .getByTestId('support-hub-banner')
      .querySelector<HTMLButtonElement>('[aria-hidden="false"] button');
    assert(result, 'Missing active banner');
    return result;
  }

  function expectActive(index: number) {
    expect(
      screen
        .getByTestId(`support-hub-banner-dot-${index}`)
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(activeCard().textContent).toContain(
      index === 0
        ? ETranslations.quiz_time__title
        : ETranslations.wallet_onekey_sifu,
    );
  }

  it('loops both directions repeatedly and settles on the corresponding real card', () => {
    render(<SupportHub />);
    expectActive(0);
    for (const end of [20, 20, 300, 300, 20, 300]) {
      const previous =
        screen
          .getByTestId('support-hub-banner-dot-0')
          .getAttribute('aria-current') === 'page'
          ? 0
          : 1;
      pointer(viewport(), 'pointerdown', 160);
      pointer(globalThis, 'pointermove', end);
      pointer(globalThis, 'pointerup', end);
      act(() => jest.advanceTimersByTime(350));
      expectActive(1 - previous);
      const track = viewport().firstElementChild as HTMLElement;
      expect(track.style.transition).toBe('none');
      expect(track.style.transform).toContain(`-${(2 - previous) * 100}%`);
    }
    expect(openWebView).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'suppresses a drag click (return to origin: %s) and allows the next deliberate click',
    (returnToOrigin) => {
      render(<SupportHub />);
      pointer(viewport(), 'pointerdown', 160);
      pointer(globalThis, 'pointermove', returnToOrigin ? 60 : 145);
      if (returnToOrigin) pointer(globalThis, 'pointermove', 160);
      pointer(globalThis, 'pointerup', returnToOrigin ? 160 : 145);
      fireEvent.click(activeCard(), { detail: 1 });
      expect(openWebView).not.toHaveBeenCalled();
      pointer(viewport(), 'pointerdown', 160);
      pointer(globalThis, 'pointerup', 160);
      fireEvent.click(activeCard(), { detail: 1 });
      expect(openWebView).toHaveBeenCalledTimes(1);
      expect(openWebView).toHaveBeenCalledWith({
        url: 'https://onekey.so/quiz-challenge?utm_source=app_support_hub',
        source: 'in-app',
      });
    },
  );

  it('keeps dot navigation in sync with five-second autoplay and pauses when unfocused', () => {
    const { rerender } = render(<SupportHub />);
    fireEvent.click(screen.getByTestId('support-hub-banner-dot-1'));
    act(() => jest.advanceTimersByTime(4999));
    expectActive(1);
    act(() => jest.advanceTimersByTime(1));
    expectActive(0);
    act(() => jest.advanceTimersByTime(5000));
    expectActive(1);
    mockFocused = false;
    rerender(<SupportHub />);
    act(() => jest.advanceTimersByTime(10_000));
    expectActive(1);
    mockFocused = true;
    rerender(<SupportHub />);
    act(() => jest.advanceTimersByTime(5000));
    expectActive(0);
    expect(openWebView).not.toHaveBeenCalled();
  });
});
