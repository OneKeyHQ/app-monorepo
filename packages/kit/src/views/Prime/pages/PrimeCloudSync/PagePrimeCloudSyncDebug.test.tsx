/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, fireEvent, render, screen, within } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import PagePrimeCloudSyncDebug from './PagePrimeCloudSyncDebug';

let mockSelectPage: (index: number) => void;
let mockScrollPage: (position: number, offset: number) => void;
const mockSetPage = jest.fn();

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: (value: unknown) => React.useRef({ value }).current,
  };
});
jest.mock('react-native-pager-view', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: React.forwardRef(
      (
        {
          children,
          onPageSelected,
          onPageScroll,
          scrollEnabled,
        }: PropsWithChildren<{
          onPageSelected: (event: {
            nativeEvent: { position: number };
          }) => void;
          onPageScroll: (event: {
            nativeEvent: { position: number; offset: number };
          }) => void;
          scrollEnabled: boolean;
        }>,
        ref,
      ) => {
        mockSelectPage = (position) =>
          onPageSelected({ nativeEvent: { position } });
        mockScrollPage = (position, offset) =>
          onPageScroll({ nativeEvent: { position, offset } });
        React.useImperativeHandle(ref, () => ({
          setPage: (index: number) => {
            mockSetPage(index, true);
            mockSelectPage(index);
          },
          setPageWithoutAnimation: (index: number) => {
            mockSetPage(index, false);
            mockSelectPage(index);
          },
        }));
        return (
          <div data-testid="pager" data-swipe={scrollEnabled}>
            {children}
          </div>
        );
      },
    ),
  };
});
jest.mock('@onekeyhq/components', () => {
  const Box = ({
    children,
    display,
  }: PropsWithChildren<{ display?: 'flex' | 'none' }>) => (
    <div style={{ display }}>{children}</div>
  );
  return {
    Stack: Box,
    XStack: Box,
    YStack: Box,
    SizableText: Box,
    Spinner: Box,
    Button: Box,
    Checkbox: Box,
    Page: Object.assign(Box, { Header: () => null, Body: Box }),
    ScrollView: ({ children }: PropsWithChildren) => (
      <div data-testid="panel-scroll">{children}</div>
    ),
    Select: ({
      value,
      onChange,
    }: {
      value: string;
      onChange: (value: string) => void;
    }) => (
      <select
        aria-label="data type"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="$ALL">All</option>
        <option value="Wallet">Wallet</option>
      </select>
    ),
    Table: ({ tabIntegrated }: { tabIntegrated?: boolean }) => (
      <div
        data-testid="table-scroll"
        data-tab-integrated={Boolean(tabIntegrated)}
      />
    ),
    TabBar: ({
      tabNames,
      focusedTab,
      onTabPress,
    }: {
      tabNames: string[];
      focusedTab: { value: string };
      onTabPress: (name: string) => void;
    }) => (
      <div>
        {tabNames.map((name) => (
          <button
            key={name}
            aria-pressed={focusedTab.value === name}
            onClick={() => onTabPress(name)}
          >
            {name}
          </button>
        ))}
      </div>
    ),
    useClipboard: () => ({ copyText: jest.fn() }),
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrimeCloudSync: {
      decryptAllLocalSyncItems: async () => [],
      decryptAllServerSyncItems: async () => [],
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({}),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{}],
  useNotificationStatusAtom: () => [{}],
  usePrimeCloudSyncPersistAtom: () => [{}],
  usePrimeMasterPasswordPersistAtom: () => [{}],
}));

it.each([false, true])(
  'keeps each page mounted and independently scrollable (native=%s)',
  async (isNative) => {
    platformEnv.isNative = isNative;
    mockSetPage.mockClear();
    await act(async () => {
      render(<PagePrimeCloudSyncDebug />);
    });
    const pager = screen.getByTestId('pager');
    expect(pager.children).toHaveLength(5);
    expect(pager.getAttribute('data-swipe')).toBe(String(isNative));
    expect(screen.getAllByTestId('panel-scroll')).toHaveLength(3);
    for (const table of screen.getAllByTestId('table-scroll')) {
      expect(table.closest('[data-testid="panel-scroll"]')).toBeNull();
      expect(table.getAttribute('data-tab-integrated')).toBe('false');
    }
    const [localFilter, serverFilter] = screen.getAllByRole('combobox', {
      hidden: true,
    });
    expect(screen.getAllByRole('combobox')).toHaveLength(isNative ? 2 : 1);
    fireEvent.change(localFilter, { target: { value: 'Wallet' } });
    fireEvent.click(screen.getByRole('button', { name: '云端数据' }));
    expect(mockSetPage).toHaveBeenLastCalledWith(1, isNative);
    expect(
      screen
        .getByRole('button', { name: '云端数据' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    if (!isNative) expect(screen.getByRole('combobox')).toBe(serverFilter);
    act(() => {
      mockScrollPage(1, 0.5);
      mockSelectPage(2);
    });
    expect(
      screen
        .getByRole('button', { name: '状态检查' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    if (!isNative) expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '本地数据' }));
    if (!isNative) expect(screen.getByRole('combobox')).toBe(localFilter);
    expect(
      within(localFilter).getByRole('option', { selected: true, hidden: true })
        .textContent,
    ).toBe('Wallet');
    expect(
      within(serverFilter).getByRole('option', { selected: true, hidden: true })
        .textContent,
    ).toBe('All');
  },
);
