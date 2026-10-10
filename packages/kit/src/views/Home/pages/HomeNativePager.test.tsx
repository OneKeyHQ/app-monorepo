import { createRef } from 'react';

import { act, render } from '@testing-library/react-native';

import type { ITabContainerRef } from '@onekeyhq/components';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import { HomeNativePager } from './HomeNativePager.native';

const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
const mockNativeEvents: {
  onPageScroll?: (event: {
    nativeEvent: { position: number; offset: number };
  }) => void;
  onPageSelected?: (event: { nativeEvent: { position: number } }) => void;
  onPageScrollStateChanged?: (event: {
    nativeEvent: { pageScrollState: 'idle' | 'dragging' | 'settling' };
  }) => void;
} = {};

jest.mock('@onekeyhq/components', () => ({
  useTheme: () => ({ bgApp: { val: '#ffffff' } }),
}));
jest.mock('./perpsChainTrace', () => ({ debugPerpsChain: jest.fn() }));
jest.mock('react-native-pager-view', () => ({
  CollapsiblePagerView: ({
    ref,
    ...events
  }: { ref: React.Ref<unknown> } & typeof mockNativeEvents) => {
    Object.assign(mockNativeEvents, events);
    const { useImperativeHandle } =
      jest.requireActual<typeof import('react')>('react');
    useImperativeHandle(ref, () => ({
      setPage: mockSetPage,
      setPageWithoutAnimation: mockSetPageWithoutAnimation,
    }));
    return null;
  },
}));
jest.mock('react-native-reanimated', () => {
  const { useRef } = jest.requireActual<typeof import('react')>('react');
  return { useSharedValue: (value: unknown) => useRef({ value }).current };
});

it.each([
  ['Spot', 'Perps', 1, true],
  ['Spot', 'History', 3, false],
  ['History', 'NFT', 2, true],
  ['History', 'Spot', 0, false],
] as const)(
  'switches from %s to %s with the default distance policy',
  (initialTabName, targetName, targetIndex, animated) => {
    mockSetPage.mockClear();
    mockSetPageWithoutAnimation.mockClear();
    const ref = createRef<ITabContainerRef>();
    render(
      <HomeNativePager
        ref={ref}
        tabs={[
          { id: EHomeWalletTab.Portfolio, name: 'Spot', component: null },
          { id: EHomeWalletTab.Perps, name: 'Perps', component: null },
          { id: EHomeWalletTab.NFT, name: 'NFT', component: null },
          { id: EHomeWalletTab.History, name: 'History', component: null },
        ]}
        initialTabName={initialTabName}
        renderHeader={() => null}
        renderTabBar={() => null}
        onTabChange={jest.fn()}
      />,
    );
    act(() => ref.current?.jumpToTab(targetName));
    expect(
      animated ? mockSetPage : mockSetPageWithoutAnimation,
    ).toHaveBeenCalledWith(targetIndex);
    expect(
      animated ? mockSetPageWithoutAnimation : mockSetPage,
    ).not.toHaveBeenCalled();
  },
);

it.each([
  ['Spot', 0, EHomeWalletTab.Perps, 0.2],
  ['Perps', 1, EHomeWalletTab.Portfolio, 0.8],
] as const)(
  'prepares a swipe from %s without changing focus when cancelled',
  (initialTabName, initialIndex, targetId, progress) => {
    const ref = createRef<ITabContainerRef>();
    const onTabPrepare = jest.fn();
    const onTabChange = jest.fn();
    render(
      <HomeNativePager
        ref={ref}
        tabs={[
          { id: EHomeWalletTab.Portfolio, name: 'Spot', component: null },
          { id: EHomeWalletTab.Perps, name: 'Perps', component: null },
        ]}
        initialTabName={initialTabName}
        renderHeader={() => null}
        renderTabBar={() => null}
        onTabChange={onTabChange}
        onTabPrepare={onTabPrepare}
      />,
    );
    const scroll = () =>
      mockNativeEvents.onPageScroll?.({
        nativeEvent: { position: 0, offset: progress },
      });
    act(scroll);
    expect(onTabPrepare).not.toHaveBeenCalled();
    act(() => {
      mockNativeEvents.onPageScrollStateChanged?.({
        nativeEvent: { pageScrollState: 'dragging' },
      });
      scroll();
      scroll();
    });
    expect(onTabPrepare).toHaveBeenCalledTimes(1);
    expect(onTabPrepare).toHaveBeenCalledWith({ tabId: targetId });
    expect(ref.current?.getCurrentIndex()).toBe(initialIndex);
    expect(ref.current?.getFocusedTab()).toBe(initialTabName);
    expect(onTabChange).not.toHaveBeenCalled();
    act(() => {
      mockNativeEvents.onPageScrollStateChanged?.({
        nativeEvent: { pageScrollState: 'idle' },
      });
      scroll();
    });
    expect(onTabPrepare).toHaveBeenCalledTimes(1);
    expect(ref.current?.getFocusedTab()).toBe(initialTabName);
    expect(onTabChange).not.toHaveBeenCalled();
    const targetIndex = initialIndex === 0 ? 1 : 0;
    act(() => {
      mockNativeEvents.onPageSelected?.({
        nativeEvent: { position: targetIndex },
      });
    });
    expect(ref.current?.getCurrentIndex()).toBe(targetIndex);
    expect(onTabChange).toHaveBeenCalledTimes(1);
  },
);

it('normalizes a removed selected key and does not reactivate it when restored', () => {
  const onTabChange = jest.fn();
  let focusedName = '';
  const spot = { id: EHomeWalletTab.Portfolio, name: 'Spot', component: null };
  const nft = { id: EHomeWalletTab.NFT, name: 'NFT', component: null };
  const common = {
    initialTabName: 'NFT',
    renderHeader: () => null,
    renderTabBar: ({ focusedTab }: { focusedTab: { value: string } }) => {
      focusedName = focusedTab.value;
      return null;
    },
    onTabChange,
  };
  const { rerender } = render(
    <HomeNativePager {...common} tabs={[spot, nft]} />,
  );
  rerender(<HomeNativePager {...common} tabs={[spot]} />);
  expect(onTabChange).toHaveBeenCalledTimes(1);
  expect(onTabChange).toHaveBeenLastCalledWith({ tabName: 'Spot' });
  rerender(<HomeNativePager {...common} tabs={[spot, nft]} />);
  expect(onTabChange).toHaveBeenCalledTimes(1);
  expect(focusedName).toBe('Spot');
});

it('ignores queued scroll progress after restoring a reordered tab', () => {
  const spot = { id: EHomeWalletTab.Portfolio, name: 'Spot', component: null };
  const perps = { id: EHomeWalletTab.Perps, name: 'Perps', component: null };
  const history = {
    id: EHomeWalletTab.History,
    name: 'History',
    component: null,
  };
  let indexDecimal: { value: number } | undefined;
  const common = {
    initialTabName: 'History',
    renderHeader: () => null,
    renderTabBar: (props: { indexDecimal: { value: number } }) => {
      indexDecimal = props.indexDecimal;
      return null;
    },
    onTabChange: jest.fn(),
  };
  const { rerender } = render(
    <HomeNativePager {...common} tabs={[spot, perps, history]} />,
  );
  rerender(<HomeNativePager {...common} tabs={[spot, history]} />);
  expect(indexDecimal?.value).toBe(1);
  act(() => {
    mockNativeEvents.onPageScroll?.({
      nativeEvent: { position: 2, offset: 0 },
    });
  });
  expect(indexDecimal?.value).toBe(1);
  act(() => {
    mockNativeEvents.onPageScrollStateChanged?.({
      nativeEvent: { pageScrollState: 'dragging' },
    });
    mockNativeEvents.onPageScroll?.({
      nativeEvent: { position: 0, offset: 0.5 },
    });
  });
  expect(indexDecimal?.value).toBe(0.5);
});

it.each([
  ['Spot', 'History', 0, 3],
  ['History', 'Spot', 3, 0],
] as const)(
  'keeps %s to %s immediate selection aligned without a native scroll event',
  (initialTabName, targetName, initialIndex, targetIndex) => {
    const ref = createRef<ITabContainerRef>();
    let tabBarState:
      | { indexDecimal: { value: number }; focusedTab: { value: string } }
      | undefined;
    render(
      <HomeNativePager
        ref={ref}
        tabs={[
          { id: EHomeWalletTab.Portfolio, name: 'Spot', component: null },
          { id: EHomeWalletTab.Perps, name: 'Perps', component: null },
          { id: EHomeWalletTab.NFT, name: 'NFT', component: null },
          { id: EHomeWalletTab.History, name: 'History', component: null },
        ]}
        initialTabName={initialTabName}
        renderHeader={() => null}
        renderTabBar={(props) => {
          tabBarState = props;
          return null;
        }}
        onTabChange={jest.fn()}
      />,
    );
    act(() => ref.current?.jumpToTab(targetName));
    expect(tabBarState?.indexDecimal.value).toBe(targetIndex);
    act(() => {
      mockNativeEvents.onPageSelected?.({
        nativeEvent: { position: targetIndex },
      });
      // A queued progress event from the previous page must not undo the jump.
      mockNativeEvents.onPageScroll?.({
        nativeEvent: { position: initialIndex, offset: 0 },
      });
    });
    expect(tabBarState?.indexDecimal.value).toBe(targetIndex);
    expect(tabBarState?.focusedTab.value).toBe(targetName);
    expect(ref.current?.getCurrentIndex()).toBe(targetIndex);

    act(() => {
      mockNativeEvents.onPageScrollStateChanged?.({
        nativeEvent: { pageScrollState: 'dragging' },
      });
      mockNativeEvents.onPageScroll?.({
        nativeEvent: { position: 1, offset: 0.4 },
      });
    });
    expect(tabBarState?.indexDecimal.value).toBe(1.4);

    act(() => ref.current?.jumpToTab(initialTabName));
    act(() => {
      mockNativeEvents.onPageSelected?.({
        nativeEvent: { position: initialIndex },
      });
    });
    const adjacentIndex = initialIndex === 0 ? 1 : 2;
    act(() => ref.current?.setIndex(adjacentIndex));
    expect(tabBarState?.indexDecimal.value).toBe(initialIndex);
    act(() => {
      mockNativeEvents.onPageScroll?.({
        nativeEvent: { position: 1, offset: 0.6 },
      });
    });
    expect(tabBarState?.indexDecimal.value).toBe(1.6);
  },
);
