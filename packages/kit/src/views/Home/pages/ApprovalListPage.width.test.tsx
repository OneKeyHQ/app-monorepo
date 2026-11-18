/** @jest-environment jsdom */

import type { Dispatch, ReactNode, SetStateAction } from 'react';

import { act, render, screen } from '@testing-library/react';

import ApprovalListPage from './ApprovalListPage';

import type { LayoutChangeEvent } from 'react-native';

let mockIsNative = true;
let mockGtLg = false;
let mockInitialized = false;
let mockSetInitialized: Dispatch<SetStateAction<boolean>> | undefined;
let mockNativeLayout: ((event: LayoutChangeEvent) => void) | undefined;
const mockApprovalProps: Array<{ tableLayout?: boolean }> = [];
const mockRun = () => {};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const Box = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const Container = ({
    children,
    onLayout,
    padded,
  }: {
    children?: ReactNode;
    onLayout?: (event: LayoutChangeEvent) => void;
    padded?: boolean;
  }) => {
    mockNativeLayout = onLayout;
    return (
      <div data-testid="approval-page-container" data-padded={String(padded)}>
        {children}
      </div>
    );
  };
  return {
    Empty: () => null,
    IconButton: () => null,
    NavBackButton: () => null,
    Page: Object.assign(Box, { Body: Box, Container, Header: () => null }),
    SizableText: Box,
    Skeleton: Object.assign(() => null, {
      BodyLg: () => null,
      BodyMd: () => null,
    }),
    Stack: Box,
    XStack: Box,
    YStack: Box,
    useMedia: () => ({ gtMd: mockGtLg, gtLg: mockGtLg }),
    useScrollContentTabBarOffset: () => 0,
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/config/presetNetworks', () => ({
  getNetworksSupportBulkRevokeApproval: () => ({}),
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { RefreshApprovalList: 'RefreshApprovalList' },
  appEventBus: { on: () => {}, off: () => {} },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { isWatchingWallet: () => false },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isAllNetwork: () => false },
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children: ReactNode }) =>
    children,
}));
jest.mock('../../../components/ApprovalListView', () => ({
  __esModule: true,
  default: (props: (typeof mockApprovalProps)[number]) => {
    mockApprovalProps.push(props);
    return <div data-testid="approval-list" />;
  },
}));
jest.mock('../../../components/ListItem', () => ({
  ListItem: ({ children }: { children: ReactNode }) => (
    <div data-testid="approval-skeleton-row">{children}</div>
  ),
}));
jest.mock('../../../components/TabPageHeader', () => ({
  TabPageHeader: () => null,
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pop: () => {}, pushModal: () => {} }),
}));
jest.mock('../../../hooks/useAppRoute', () => ({
  useAppRoute: () => ({ params: {} }),
}));
jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: true, run: mockRun }),
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: { id: 'account' },
      network: { id: 'evm--1' },
      wallet: { id: 'wallet' },
    },
  }),
}));
jest.mock('../../../states/jotai/contexts/approvalList', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    ProviderJotaiContextApprovalList: ({ children }: { children: ReactNode }) =>
      children,
    useApprovalListActions: () => ({}),
    useApprovalListAtom: () => [{ approvals: [] }],
    useTokenMapAtom: () => [{ tokenMap: {} }],
    useContractMapAtom: () => [{ contractMap: {} }],
    useApprovalListStateAtom: () => {
      const [initialized, setInitialized] = React.useState(mockInitialized);
      mockSetInitialized = setInitialized;
      return [{ initialized }];
    },
  };
});

function setWidth(width: number) {
  act(() => {
    mockNativeLayout?.({
      nativeEvent: { layout: { width } },
    } as LayoutChangeEvent);
  });
}

function setPageInitialized(initialized: boolean) {
  act(() => mockSetInitialized?.(initialized));
}

beforeEach(() => {
  mockIsNative = true;
  mockGtLg = false;
  mockInitialized = false;
  mockSetInitialized = undefined;
  mockNativeLayout = undefined;
  mockApprovalProps.length = 0;
});

it('keeps native skeleton and loaded rows on the same 768-point boundary', () => {
  mockGtLg = true;
  render(<ApprovalListPage />);
  expect(screen.getByTestId('approval-page-container').dataset.padded).toBe(
    'false',
  );
  expect(screen.getAllByTestId('approval-skeleton-row')).toHaveLength(5);
  expect(mockNativeLayout).toBeDefined();

  for (const [width, tableLayout] of [
    [0, false],
    [767, false],
    [768, true],
    [767, false],
    [768, true],
  ] as const) {
    setWidth(width);
    expect(screen.getAllByTestId('approval-skeleton-row')).toHaveLength(
      tableLayout ? 6 : 5,
    );
    setPageInitialized(true);
    expect(screen.queryByTestId('approval-skeleton-row')).toBeNull();
    expect(mockApprovalProps.at(-1)?.tableLayout).toBe(tableLayout);
    setPageInitialized(false);
  }
});

it('updates initialized native rows when the measured container shrinks and grows', () => {
  mockInitialized = true;
  render(<ApprovalListPage />);
  expect(mockApprovalProps.at(-1)?.tableLayout).toBe(false);
  for (const [width, expected] of [
    [767, false],
    [768, true],
    [767, false],
  ] as const) {
    setWidth(width);
    expect(mockApprovalProps.at(-1)?.tableLayout).toBe(expected);
  }
});

it.each([false, true])(
  'preserves the Web gtLg=%s layout without native measurement',
  (gtLg) => {
    mockIsNative = false;
    mockGtLg = gtLg;
    render(<ApprovalListPage />);
    expect(mockNativeLayout).toBeUndefined();
    expect(screen.getAllByTestId('approval-skeleton-row')).toHaveLength(
      gtLg ? 6 : 5,
    );
    setPageInitialized(true);
    expect(mockApprovalProps.at(-1)?.tableLayout).toBe(gtLg);
  },
);
