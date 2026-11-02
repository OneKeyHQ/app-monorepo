/** @jest-environment jsdom */

import type { ReactNode, Ref } from 'react';
import { useEffect } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { openWebView } from '../../../WebView/utils/webViewNavigation';

import { SupportHub } from './SupportHub';

type IPageScrollState = 'idle' | 'dragging' | 'settling';

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
  }: {
    children?: ReactNode;
    onPress?: () => void;
    onLayout?: (event: {
      nativeEvent: { layout: { width: number; height: number } };
    }) => void;
    ref?: Ref<HTMLDivElement>;
  }) => {
    useEffect(() => {
      onLayout?.({ nativeEvent: { layout: { width: 320, height: 151 } } });
    }, [onLayout]);
    return onPress ? (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ) : (
      <div ref={ref}>{children}</div>
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
  showIntercom: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isWeb: false, isExtension: false },
}));

jest.mock('../../../WebView/utils/webViewNavigation', () => ({
  openWebView: jest.fn(),
}));

jest.mock('../RichBlock', () => ({
  RichBlock: ({ content }: { content?: ReactNode }) => content,
}));

describe('SupportHub banner carousel press suppression', () => {
  beforeEach(() => {
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
