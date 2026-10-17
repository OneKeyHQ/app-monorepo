import * as React from 'react';

import { act, render } from '@testing-library/react-native';

import { WebCollapsiblePager } from './WebCollapsiblePager';

const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
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
    CollapsiblePagerView: ({
      ref,
      onPageSelected,
    }: {
      ref: React.Ref<unknown>;
      onPageSelected: typeof mockSelected;
    }) => {
      mockSelected = onPageSelected;
      react.useImperativeHandle(ref, () => ({
        setPage: mockSetPage,
        setPageWithoutAnimation: mockSetPageWithoutAnimation,
      }));
      return null;
    },
    NativeScroller: () => null,
  };
});

const page = (name: string, value = name) => ({
  key: name,
  name,
  children: value,
});

describe('WebCollapsiblePager selection bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not drive the SDK back during stable-key business rerenders', () => {
    const onTabChange = jest.fn();
    const screen = render(
      <WebCollapsiblePager
        onTabChange={onTabChange}
        pages={[page('Spot'), page('DeFi')]}
      />,
    );
    act(() => mockSelected({ nativeEvent: { position: 1 } }));
    screen.rerender(
      <WebCollapsiblePager
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
      <WebCollapsiblePager pages={[page('A'), page('B'), page('C')]} />,
    );
    act(() => mockSelected({ nativeEvent: { position: 1 } }));
    screen.rerender(
      <WebCollapsiblePager pages={[page('B'), page('A'), page('C')]} />,
    );
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledTimes(1);
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(0);
  });

  it('keeps business identity when labels match and selects a valid survivor on removal', () => {
    const pages = [
      { key: 'a', name: 'Same', children: 'A' },
      { key: 'b', name: 'Same', children: 'B' },
    ];
    const screen = render(<WebCollapsiblePager pages={pages} />);
    act(() => mockSelected({ nativeEvent: { position: 1 } }));
    screen.rerender(<WebCollapsiblePager pages={[pages[1], pages[0]]} />);
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(0);
    screen.rerender(<WebCollapsiblePager pages={[pages[0]]} />);
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(0);
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledTimes(2);
  });
});
