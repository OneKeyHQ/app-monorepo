/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import ApprovalListView from '.';

import { fireEvent, render, screen } from '@testing-library/react';

let mockIsNative = true;
let mockLayoutWidth = 0;
let mockContextTableLayout: boolean | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const List = ({
    onLayout,
    estimatedItemSize,
    ListHeaderComponent,
  }: {
    onLayout?: (event: { nativeEvent: { layout: { width: number } } }) => void;
    estimatedItemSize?: number;
    ListHeaderComponent?: ReactNode;
  }) => (
    <button
      type="button"
      data-testid="approval-list-root"
      data-item-size={String(estimatedItemSize)}
      data-has-header={String(Boolean(ListHeaderComponent))}
      onClick={() =>
        onLayout?.({ nativeEvent: { layout: { width: mockLayoutWidth } } })
      }
    >
      Layout
    </button>
  );
  return {
    ListView: List,
    Tabs: { FlatList: List },
    Stack: ({ children }: { children?: ReactNode }) => <>{children}</>,
    YStack: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useStyle: (value: unknown) => value,
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
    isNativeAndroid: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isAllNetwork: () => false },
}));

jest.mock('../../states/jotai/contexts/approvalList', () => ({
  useApprovalListAtom: () => [{ approvals: [] }],
  useApprovalListStateAtom: () => [{ initialized: true }],
  useSearchKeyAtom: () => [''],
  useSearchNetworkAtom: () => [{ networkId: '' }],
  useContractMapAtom: () => [{ contractMap: {} }],
  useTokenMapAtom: () => [{ tokenMap: {} }],
}));

jest.mock('../../views/DAppConnection/hooks/useActiveTabDAppInfo', () => ({
  __esModule: true,
  default: () => ({ result: undefined }),
}));

jest.mock('../../views/Home/components/PullToRefresh', () => ({
  PullToRefresh: () => null,
}));
jest.mock('../Empty', () => ({ EmptyApproval: () => null }));
jest.mock('../Loading/ListLoading', () => ({ ListLoading: () => null }));
jest.mock('./ApprovalListHeader', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./ApprovalListItem', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./ApprovalListViewContext', () => ({
  ApprovalListViewContext: {
    Provider: ({
      value,
      children,
    }: {
      value: { tableLayout?: boolean };
      children: ReactNode;
    }) => {
      mockContextTableLayout = value.tableLayout;
      return children;
    },
  },
}));

const props = { accountId: 'account', networkId: 'evm--1' };

beforeEach(() => {
  mockIsNative = true;
  mockLayoutWidth = 0;
  mockContextTableLayout = undefined;
});

it('switches the existing native list and context together at its actual width', () => {
  render(<ApprovalListView {...props} />);
  const list = screen.getByTestId('approval-list-root');
  for (const [width, expected] of [
    [767, false],
    [768, true],
    [767, false],
  ] as const) {
    mockLayoutWidth = width;
    fireEvent.click(list);
    expect(mockContextTableLayout).toBe(expected);
    expect(list.dataset.itemSize).toBe(expected ? 'undefined' : '60');
  }
});

it.each([
  [true, 320, true],
  [false, 1024, false],
] as const)(
  'keeps explicit tableLayout=%s at width %i',
  (tableLayout, width, expected) => {
    render(<ApprovalListView {...props} tableLayout={tableLayout} />);
    mockLayoutWidth = width;
    fireEvent.click(screen.getByTestId('approval-list-root'));
    expect(mockContextTableLayout).toBe(expected);
  },
);

it('keeps Web default compact when no tableLayout is supplied', () => {
  mockIsNative = false;
  render(<ApprovalListView {...props} />);
  mockLayoutWidth = 1024;
  fireEvent.click(screen.getByTestId('approval-list-root'));
  expect(mockContextTableLayout).toBe(false);
});

it('shows a table-only header in revoke suggestions only in native wide mode', () => {
  render(<ApprovalListView {...props} withHeader hideRiskOverview />);
  const list = screen.getByTestId('approval-list-root');
  expect(list.dataset.hasHeader).toBe('false');
  mockLayoutWidth = 768;
  fireEvent.click(list);
  expect(list.dataset.hasHeader).toBe('true');
  mockLayoutWidth = 767;
  fireEvent.click(list);
  expect(list.dataset.hasHeader).toBe('false');
});
