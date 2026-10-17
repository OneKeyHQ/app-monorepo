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
jest.mock('@onekeyhq/components', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    TabsContext: react.createContext({}),
    TabsScrollContext: react.createContext({}),
    TabNameContext: react.createContext(''),
  };
});
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

function Tab({ children }: { name: string; children?: React.ReactNode }) {
  return children ?? null;
}

const tab = (name: string, value = name) => (
  <Tab key={name} name={name}>
    {value}
  </Tab>
);

describe('WebCollapsiblePager selection bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not drive the SDK back during stable-key business rerenders', () => {
    const onTabChange = jest.fn();
    const screen = render(
      <WebCollapsiblePager onTabChange={onTabChange}>
        {tab('Spot')}
        {tab('DeFi')}
      </WebCollapsiblePager>,
    );
    act(() => mockSelected({ nativeEvent: { position: 1 } }));
    screen.rerender(
      <WebCollapsiblePager
        onTabChange={(event) => {
          onTabChange(event);
        }}
      >
        {tab('Spot', 'updated header source')}
        {tab('DeFi', 'loaded protocols')}
      </WebCollapsiblePager>,
    );
    expect(onTabChange).toHaveBeenCalledWith(
      expect.objectContaining({ tabName: 'DeFi', index: 1 }),
    );
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
    expect(mockSetPage).not.toHaveBeenCalled();
  });

  it('synchronizes the selected business key only when page order changes', () => {
    const screen = render(
      <WebCollapsiblePager>
        {tab('A')}
        {tab('B')}
        {tab('C')}
      </WebCollapsiblePager>,
    );
    act(() => mockSelected({ nativeEvent: { position: 1 } }));
    screen.rerender(
      <WebCollapsiblePager>
        {tab('B')}
        {tab('A')}
        {tab('C')}
      </WebCollapsiblePager>,
    );
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledTimes(1);
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(0);
  });
});
