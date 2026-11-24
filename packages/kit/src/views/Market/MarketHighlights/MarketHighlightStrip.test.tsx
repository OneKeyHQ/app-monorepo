/** @jest-environment jsdom */

import type { AriaRole, PropsWithChildren } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import type { IMarketHighlight } from '@onekeyhq/shared/types/marketV2';

import { MarketHighlightStrip } from './MarketHighlightStrip';

let mockRouteFocused = true;
const mockPushModal = jest.fn();
const mockQuote = { price: '123', logoUrl: 'https://example.com/token.png' };

type IStackProps = PropsWithChildren<{
  role?: AriaRole;
  tabIndex?: number;
  onPress?: () => void;
  'aria-hidden'?: boolean;
  pointerEvents?: 'auto' | 'none';
}>;

jest.mock('@onekeyhq/components', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');
  const Stack = forwardRef<HTMLDivElement, IStackProps>(function MockStack(
    { children, role, tabIndex, onPress, 'aria-hidden': hidden, pointerEvents },
    ref,
  ) {
    if (onPress) {
      return (
        <button
          type="button"
          tabIndex={tabIndex}
          onClick={onPress}
          aria-hidden={hidden}
          style={{ pointerEvents }}
        >
          {children}
        </button>
      );
    }
    return (
      <div
        ref={ref}
        role={role}
        tabIndex={tabIndex}
        aria-hidden={hidden}
        style={{ pointerEvents }}
      >
        {children}
      </div>
    );
  });
  return {
    XStack: Stack,
    YStack: Stack,
    SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
    Icon: () => null,
  };
});
jest.mock('react-native-reanimated', () => {
  const { useRef } = jest.requireActual<typeof import('react')>('react');
  const { YStack } = jest.requireMock<{ YStack: unknown }>(
    '@onekeyhq/components',
  );
  let animation: ReturnType<typeof setTimeout> | undefined;
  return {
    __esModule: true,
    cancelAnimation: () => clearTimeout(animation),
    default: { View: YStack },
    Easing: { inOut: (value: unknown) => value, cubic: jest.fn() },
    Extrapolation: { CLAMP: 'clamp' },
    interpolate: () => 1,
    useAnimatedStyle: (callback: () => object) => callback(),
    useReducedMotion: () => false,
    useSharedValue: (value: number) => useRef({ value }).current,
    runOnJS: (callback: unknown) => callback,
    withTiming: (
      value: number,
      config: { duration: number },
      complete?: (finished: boolean) => void,
    ) => {
      animation = setTimeout(() => complete?.(true), config.duration);
      return value;
    },
  };
});
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockRouteFocused,
}));

beforeEach(() => {
  mockRouteFocused = true;
});

jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en-US',
}));
jest.mock('../components/PerpsBadges', () => ({ LeverageBadge: () => null }));
jest.mock('../components/PriceChangePercentage', () => ({
  PriceChangePercentage: () => null,
}));
jest.mock('../MarketDetailV2/utils/marketDetailImagePreload', () => ({
  prewarmMarketTokenImages: jest.fn(),
}));
jest.mock('./useMarketHighlightQuotes', () => ({
  useMarketHighlightQuotes: (assets?: IMarketHighlight['assets']) =>
    new Map(
      assets?.map((asset) => [
        `stock:${asset.type === 'stock' ? asset.stockId : ''}`,
        mockQuote,
      ]),
    ),
}));

it('keeps the visible first headline interactive throughout the carousel wrap', () => {
  jest.useFakeTimers();
  const items: IMarketHighlight[] = ['First', 'Last'].map((title) => ({
    highlightId: title,
    title,
    description: '',
    publishedAt: '2026-11-16T00:00:00Z',
    assets: [],
    links: [],
  }));
  const view = render(
    <MarketHighlightStrip highlight={items[0]} highlights={items} compact />,
  );
  try {
    act(() => jest.advanceTimersByTime(8000));
    const [original, , copy] = view.getAllByRole('button', { hidden: true });
    expect(copy.tabIndex).toBe(0);
    expect(copy.parentElement?.getAttribute('aria-hidden')).toBe('false');
    expect(copy.parentElement?.style.pointerEvents).toBe('auto');
    fireEvent.click(copy);
    expect(mockPushModal).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        params: expect.objectContaining({
          initialHighlights: { locale: 'en-US', items },
        }),
      }),
    );

    act(() => jest.advanceTimersByTime(600));
    expect(original.tabIndex).toBe(0);
    expect(original.parentElement?.getAttribute('aria-hidden')).toBe('false');
    expect(original.parentElement?.style.pointerEvents).toBe('auto');
    expect(copy.tabIndex).toBe(-1);
    expect(copy.parentElement?.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(original);
    expect(mockPushModal).toHaveBeenCalledTimes(2);
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('opens the details with prefetched quotes beyond the five carousel headlines', () => {
  const items: IMarketHighlight[] = Array.from({ length: 6 }, (_, index) => ({
    highlightId: String(index),
    title: `Headline ${index}`,
    description: '',
    publishedAt: '2026-11-16T00:00:00Z',
    assets: [
      {
        type: 'stock',
        symbol: `STOCK${index}`,
        stockId: `STOCK${index}`,
        favorite: {
          stockId: `STOCK${index}`,
          chainId: '',
          contractAddress: '',
        },
      },
    ],
    links: [],
  }));
  const view = render(
    <MarketHighlightStrip highlight={items[0]} highlights={items} compact />,
  );
  fireEvent.click(view.getAllByRole('button')[0]);
  expect(mockPushModal).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({
      params: expect.objectContaining({
        initialQuotes: expect.arrayContaining([['stock:STOCK5', mockQuote]]),
      }),
    }),
  );
});

it('passes the clicked headline for initial modal positioning', () => {
  jest.useFakeTimers();
  const items: IMarketHighlight[] = ['First', 'Later'].map((title) => ({
    highlightId: title,
    title,
    description: '',
    publishedAt: '2026-11-16T00:00:00Z',
    assets: [],
    links: [],
  }));
  const view = render(
    <MarketHighlightStrip highlight={items[0]} highlights={items} compact />,
  );
  try {
    act(() => jest.advanceTimersByTime(4600));
    fireEvent.click(view.getByRole('button', { name: 'Later' }));
    expect(mockPushModal).toHaveBeenLastCalledWith(expect.anything(), {
      screen: expect.anything(),
      params: {
        initialHighlightId: 'Later',
        initialHighlights: { locale: 'en-US', items },
        initialQuotes: [],
      },
    });
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('keeps the current headline while away and waits a full interval on return', () => {
  jest.useFakeTimers();
  const items: IMarketHighlight[] = ['First', 'Later'].map((title) => ({
    highlightId: title,
    title,
    description: '',
    publishedAt: '2026-11-16T00:00:00Z',
    assets: [],
    links: [],
  }));
  const strip = () => (
    <MarketHighlightStrip highlight={items[0]} highlights={items} compact />
  );
  const view = render(strip());
  try {
    act(() => jest.advanceTimersByTime(4200));
    mockRouteFocused = false;
    view.rerender(strip());
    act(() => jest.advanceTimersByTime(20_000));
    expect(view.getByRole('button', { name: 'Later' }).tabIndex).toBe(0);
    mockRouteFocused = true;
    view.rerender(strip());
    act(() => jest.advanceTimersByTime(3999));
    expect(view.getByRole('button', { name: 'Later' }).tabIndex).toBe(0);
    act(() => jest.advanceTimersByTime(1));
    expect(view.getByRole('button', { name: 'First' }).tabIndex).toBe(0);
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('does not rotate a preloaded Market tab before it becomes visible', () => {
  jest.useFakeTimers();
  mockRouteFocused = false;
  const items: IMarketHighlight[] = ['First', 'Later'].map((title) => ({
    highlightId: title,
    title,
    description: '',
    publishedAt: '2026-11-16T00:00:00Z',
    assets: [],
    links: [],
  }));
  const strip = () => (
    <MarketHighlightStrip highlight={items[0]} highlights={items} compact />
  );
  const view = render(strip());
  try {
    act(() => jest.advanceTimersByTime(4600));
    expect(view.getByRole('button', { name: 'First' }).tabIndex).toBe(0);
    mockRouteFocused = true;
    view.rerender(strip());
    act(() => jest.advanceTimersByTime(3999));
    expect(view.getByRole('button', { name: 'First' }).tabIndex).toBe(0);
    act(() => jest.advanceTimersByTime(1));
    expect(view.getByRole('button', { name: 'Later' }).tabIndex).toBe(0);
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});
