import * as React from 'react';

import { act, render } from '@testing-library/react-native';

import { AppPager } from './AppPager';

const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
let mockScroll: (event: {
  nativeEvent: { position: number; offset: number };
}) => void;
let mockSelected: (event: { nativeEvent: { position: number } }) => void;

jest.mock('react-native', () => ({
  View: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock('react-native-reanimated', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: (value: unknown) => react.useRef({ value }).current,
  };
});
jest.mock('@onekeyhq/components', () => ({ YStack: () => null }));
jest.mock('react-native-pager-view', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    WebCollapsiblePagerView: ({
      ref,
      onPageSelected,
      onPageScroll,
    }: {
      ref: React.Ref<unknown>;
      onPageSelected: typeof mockSelected;
      onPageScroll: typeof mockScroll;
    }) => {
      mockSelected = onPageSelected;
      mockScroll = onPageScroll;
      react.useImperativeHandle(ref, () => ({
        setPage: mockSetPage,
        setPageWithoutAnimation: mockSetPageWithoutAnimation,
      }));
      return null;
    },
    NativeScroller: () => null,
    useWebCollapsiblePagerPage: () => null,
  };
});

const page = (name: string, value = name) => ({
  key: name,
  name,
  children: value,
});

describe('AppPager selection bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not drive the SDK back during stable-key business rerenders', () => {
    const onTabChange = jest.fn();
    const screen = render(
      <AppPager
        onTabChange={onTabChange}
        pages={[page('Spot'), page('DeFi')]}
      />,
    );
    act(() => mockSelected({ nativeEvent: { position: 1 } }));
    screen.rerender(
      <AppPager
        onTabChange={(event) => {
          onTabChange(event);
        }}
        pages={[
          page('Spot', 'updated header source'),
          page('DeFi', 'loaded protocols'),
        ]}
      />,
    );
    expect(onTabChange).toHaveBeenCalledWith(
      expect.objectContaining({ tabName: 'DeFi', index: 1 }),
    );
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
    expect(mockSetPage).not.toHaveBeenCalled();
  });

  it('synchronizes the selected business key only when page order changes', () => {
    const screen = render(
      <AppPager pages={[page('A'), page('B'), page('C')]} />,
    );
    act(() => mockSelected({ nativeEvent: { position: 1 } }));
    screen.rerender(<AppPager pages={[page('B'), page('A'), page('C')]} />);
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledTimes(1);
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(0);
  });

  it('keeps business identity when labels match and selects a valid survivor on removal', () => {
    const pages = [
      { key: 'a', name: 'Same', children: 'A' },
      { key: 'b', name: 'Same', children: 'B' },
    ];
    const screen = render(<AppPager pages={pages} />);
    act(() => mockSelected({ nativeEvent: { position: 1 } }));
    screen.rerender(<AppPager pages={[pages[1], pages[0]]} />);
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(0);
    screen.rerender(<AppPager pages={[pages[0]]} />);
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(0);
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledTimes(2);
  });
});

it('exposes SDK progress through the common tabbar interface', () => {
  let props: import('./AppPager/types').IAppPagerTabBarProps | undefined;
  render(
    <AppPager
      pages={[page('A'), page('B')]}
      renderTabBar={(value) => {
        props = value;
        return null;
      }}
    />,
  );
  act(() => mockScroll({ nativeEvent: { position: 0, offset: 0.45 } }));
  expect(props?.indexDecimal?.value).toBe(0.45);
});
