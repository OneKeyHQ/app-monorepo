import { createRef, useContext, useEffect } from 'react';
import type { ReactNode, Ref } from 'react';

import { act, render } from '@testing-library/react-native';

import { AppPagerPageContext } from '@onekeyhq/kit/src/components/AppPager/context';
import type {
  IAppPagerPage,
  IAppPagerRef,
} from '@onekeyhq/kit/src/components/AppPager/types';

import { TokenDetailsPager } from './TokenDetailsPager.native';

let mockRouteFocused = true;
let mockPagerProps: {
  onPageSelected: (event: { nativeEvent: { position: number } }) => void;
  onNativeTabPress: (event: {
    nativeEvent: { position: number; key: string };
  }) => void;
  nativeTabBar: {
    items: readonly { key: string; title: string }[];
    style: { height: number; trailingReservedWidth: number };
  };
  stickyHeaderHeight: number;
  stickyHeader: ReactNode;
};
let mockToolbarLayout: (event: {
  nativeEvent: { layout: { width: number } };
}) => void;
const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
const mockProbe = jest.fn();
const mockMount = jest.fn();
const mockUnmount = jest.fn();

jest.mock('react-native-reanimated', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: (value: unknown) => react.useRef({ value }).current,
  };
});
jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 1 },
  View: ({
    children,
    onLayout,
  }: {
    children: ReactNode;
    onLayout?: typeof mockToolbarLayout;
  }) => {
    if (onLayout) mockToolbarLayout = onLayout;
    return children;
  },
}));
jest.mock('react-native-pager-view', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    CollapsiblePagerView: react.forwardRef(
      (
        props: {
          children: ReactNode;
          onPageSelected: (event: {
            nativeEvent: { position: number };
          }) => void;
          onNativeTabPress: typeof mockPagerProps.onNativeTabPress;
          nativeTabBar: typeof mockPagerProps.nativeTabBar;
          stickyHeaderHeight: number;
          stickyHeader: ReactNode;
        },
        ref: Ref<unknown>,
      ) => {
        mockPagerProps = props;
        react.useImperativeHandle(ref, () => ({
          setPage: mockSetPage,
          setPageWithoutAnimation: mockSetPageWithoutAnimation,
          scrollToPageTop: jest.fn(),
        }));
        return (
          <>
            {props.stickyHeader}
            {props.children}
          </>
        );
      },
    ),
  };
});

jest.mock('@onekeyhq/components', () => ({
  BRAND_FONT_NATIVE_FAMILY: { medium: 'OneKeySans-Medium' },
  useTheme: () => ({
    bgApp: { val: '#fff' },
    borderSubdued: { val: '#ddd' },
    text: { val: '#000' },
    textSubdued: { val: '#777' },
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockRouteFocused,
}));

function Probe() {
  const { key, isFocused } = useContext(AppPagerPageContext);
  mockProbe(key, isFocused);
  useEffect(() => {
    mockMount(key);
    return () => {
      mockUnmount(key);
    };
  }, [key]);
  return null;
}

const overview: IAppPagerPage = {
  key: 'overview',
  name: 'Overview',
  children: <Probe />,
};
const first: IAppPagerPage = {
  key: 'first',
  name: 'First',
  children: <Probe />,
};
const second: IAppPagerPage = {
  key: 'second',
  name: 'Second',
  children: <Probe />,
};
const inserted: IAppPagerPage = {
  key: 'inserted',
  name: 'Inserted',
  children: <Probe />,
};

beforeEach(() => {
  mockRouteFocused = true;
  mockSetPage.mockClear();
  mockSetPageWithoutAnimation.mockClear();
  mockProbe.mockClear();
  mockMount.mockClear();
  mockUnmount.mockClear();
});

it('reserves only the measured toolbar width beside stable native tab identities', () => {
  const { rerender } = render(
    <TokenDetailsPager pages={[overview, first]} toolbar={null} />,
  );
  expect(mockPagerProps.nativeTabBar.items).toEqual([
    { key: 'overview', title: 'Overview' },
    { key: 'first', title: 'First' },
  ]);
  expect(mockPagerProps.nativeTabBar.style.height).toBe(44);
  expect(mockPagerProps.stickyHeaderHeight).toBe(45);
  expect(mockPagerProps.nativeTabBar.style.trailingReservedWidth).toBe(0);

  rerender(
    <TokenDetailsPager pages={[overview, first]} toolbar="network selector" />,
  );
  act(() => mockToolbarLayout({ nativeEvent: { layout: { width: 67.5 } } }));
  expect(mockPagerProps.nativeTabBar.style.trailingReservedWidth).toBe(68);

  rerender(<TokenDetailsPager pages={[overview, first]} toolbar={null} />);
  act(() => mockToolbarLayout({ nativeEvent: { layout: { width: 0 } } }));
  expect(mockPagerProps.nativeTabBar.style.trailingReservedWidth).toBe(0);
});

it('commits a native tab selection without sending a second pager command', () => {
  const onIndexChange = jest.fn();
  const onTabChange = jest.fn();
  render(
    <TokenDetailsPager
      pages={[overview, first]}
      onIndexChange={onIndexChange}
      onTabChange={onTabChange}
    />,
  );
  act(() =>
    mockPagerProps.onNativeTabPress({
      nativeEvent: { position: 1, key: 'stale-key' },
    }),
  );
  expect(mockMount.mock.calls).toEqual([['overview']]);

  act(() =>
    mockPagerProps.onNativeTabPress({
      nativeEvent: { position: 1, key: 'first' },
    }),
  );
  expect(mockMount.mock.calls).toEqual([['overview'], ['first']]);
  expect(mockProbe).toHaveBeenLastCalledWith('first', false);
  expect(onIndexChange).not.toHaveBeenCalled();
  expect(onTabChange).not.toHaveBeenCalled();
  expect(mockSetPage).not.toHaveBeenCalled();
  expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();

  act(() => mockPagerProps.onPageSelected({ nativeEvent: { position: 1 } }));
  expect(onIndexChange).toHaveBeenCalledWith(1);
  expect(mockProbe).toHaveBeenLastCalledWith('first', true);
  expect(onTabChange).toHaveBeenCalledWith({
    prevIndex: 0,
    index: 1,
    prevTabName: 'Overview',
    tabName: 'First',
  });
  expect(mockSetPage).not.toHaveBeenCalled();
  expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
});

it('mounts only visited business pages and preserves them across distant tabs', () => {
  const pages = Array.from(
    { length: 21 },
    (_, index): IAppPagerPage => ({
      key: `member-${index}`,
      name: `Member ${index}`,
      children: <Probe />,
    }),
  );
  const ref = createRef<IAppPagerRef>();
  const { rerender } = render(<TokenDetailsPager ref={ref} pages={pages} />);
  expect(mockMount.mock.calls).toEqual([['member-0']]);

  act(() => mockPagerProps.onPageSelected({ nativeEvent: { position: 20 } }));
  expect(mockMount.mock.calls).toEqual([['member-0'], ['member-20']]);
  act(() => mockPagerProps.onPageSelected({ nativeEvent: { position: 0 } }));
  expect(mockMount).toHaveBeenCalledTimes(2);
  expect(mockUnmount).not.toHaveBeenCalled();

  rerender(<TokenDetailsPager ref={ref} pages={pages.slice(0, 20)} />);
  expect(mockUnmount).toHaveBeenCalledWith('member-20');
  rerender(<TokenDetailsPager ref={ref} pages={pages} />);
  expect(mockMount).toHaveBeenCalledTimes(2);
});

it('keeps the focused page key across insertion and falls back when removed', () => {
  const ref = createRef<IAppPagerRef>();
  const onIndexChange = jest.fn();
  const { rerender } = render(
    <TokenDetailsPager
      ref={ref}
      pages={[overview, first, second]}
      onIndexChange={onIndexChange}
    />,
  );
  act(() => mockPagerProps.onPageSelected({ nativeEvent: { position: 2 } }));
  expect(ref.current?.getFocusedTab()).toBe('Second');
  expect(mockProbe).toHaveBeenLastCalledWith('second', true);
  expect(onIndexChange).toHaveBeenLastCalledWith(2);

  rerender(
    <TokenDetailsPager
      ref={ref}
      pages={[overview, first, inserted, second]}
      onIndexChange={onIndexChange}
    />,
  );
  expect(ref.current?.getFocusedTab()).toBe('Second');
  expect(ref.current?.getCurrentIndex()).toBe(3);
  expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(3);
  expect(onIndexChange).toHaveBeenCalledTimes(1);

  mockRouteFocused = false;
  rerender(
    <TokenDetailsPager
      ref={ref}
      pages={[overview, first, inserted, second]}
      onIndexChange={onIndexChange}
    />,
  );
  expect(mockProbe).toHaveBeenLastCalledWith('second', false);

  mockRouteFocused = true;
  rerender(
    <TokenDetailsPager
      ref={ref}
      pages={[overview, first, inserted]}
      onIndexChange={onIndexChange}
    />,
  );
  expect(ref.current?.getFocusedTab()).toBe('Overview');
  expect(ref.current?.getCurrentIndex()).toBe(0);
  expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(0);
});
