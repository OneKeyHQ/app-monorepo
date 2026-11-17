/** @jest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';

import EarnProtocols from '.';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

let mockIsNative = true;
let mockWidth = 0;
let mockGtSm = false;
let mockGtMd = false;
let mockTableProps:
  | {
      columns: { key: string; comparator?: unknown }[];
      tableLayout?: boolean;
      withHeader?: boolean;
      data: IStakeProtocolListItem[];
      onSortChange?: (key: string, direction: 'asc' | 'desc') => void;
    }
  | undefined;

const mockProtocols = [
  {
    provider: {
      name: 'Range',
      logoURI: '',
      category: 'simpleEarn',
      aprWithoutFee: '2% - 10%',
      totalFiatValue: '$1M',
    },
    network: { networkId: 'evm--1', name: 'Ethereum', logoURI: '' },
    isEarning: false,
  },
  {
    provider: {
      name: 'Flat',
      logoURI: '',
      category: 'simpleEarn',
      aprWithoutFee: '5%',
      totalFiatValue: '$2M',
    },
    network: { networkId: 'evm--1', name: 'Ethereum', logoURI: '' },
    isEarning: false,
  },
] as IStakeProtocolListItem[];

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({
    children,
    onLayout,
  }: {
    children?: ReactNode;
    onLayout?: (event: { nativeEvent: { layout: { width: number } } }) => void;
  }) => (
    <div>
      {onLayout ? (
        <button
          type="button"
          data-testid="earn-content-layout"
          onClick={() =>
            onLayout({ nativeEvent: { layout: { width: mockWidth } } })
          }
        >
          Layout
        </button>
      ) : null}
      {children}
    </div>
  );
  return {
    Badge: Object.assign(Container, { Text: Container }),
    Empty: Container,
    SizableText: Container,
    Skeleton: Container,
    Stack: Container,
    XStack: Container,
    YStack: Container,
    useMedia: () => ({ gtSm: mockGtSm, gtMd: mockGtMd }),
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

jest.mock('@onekeyhq/shared/src/utils/earnUtils', () => ({
  __esModule: true,
  default: {
    isPendleProvider: () => false,
    shouldSendEarnProtocolVault: () => false,
  },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isAllNetwork: () => false },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { staking: { page: { selectProvider: jest.fn() } } },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: { getProtocolList: async () => mockProtocols },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      ready: true,
      account: { id: 'account' },
      network: { id: 'evm--1' },
    },
  }),
}));

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children: ReactNode }) =>
    children,
}));
jest.mock(
  '../../../Discovery/components/DiscoveryBrowserProviderMirror',
  () => ({
    DiscoveryBrowserProviderMirror: ({ children }: { children: ReactNode }) =>
      children,
  }),
);
jest.mock('../../components/EarnPageContainer', () => ({
  EarnPageContainer: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@onekeyhq/kit/src/components/ListView/TableList', () => ({
  TableList: (props: typeof mockTableProps) => {
    mockTableProps = props;
    return (
      <div data-testid="protocol-table">
        {props?.data.map((item) => item.provider.name).join(',')}
        <button
          type="button"
          onClick={() => props?.onSortChange?.('tvl', 'desc')}
        >
          TVL header
        </button>
      </div>
    );
  },
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar', () => ({
  NetworkAvatarGroup: () => null,
}));
jest.mock('../../../Staking/components/ProtocolDetails/EarnText', () => ({
  EarnText: () => null,
}));
jest.mock('../../components/AprText', () => ({ AprText: () => null }));
jest.mock('../../components/NetworkFilterControl', () => ({
  NetworkFilterControl: () => null,
}));
jest.mock('../../components/EarnMobileSortControl', () => ({
  EarnMobileSortControl: ({
    onSortChange,
  }: {
    onSortChange: (key: string, direction: 'asc' | 'desc') => void;
  }) => (
    <button type="button" onClick={() => onSortChange('yield', 'desc')}>
      Yield control
    </button>
  ),
}));
jest.mock('../../earnUtils', () => ({
  EarnNavigation: { pushToEarnProtocolDetails: jest.fn() },
  parseFormattedLiquidityValue: (value: string) => Number(value),
}));

const route = { params: { symbol: 'USDC' } } as ComponentProps<
  typeof EarnProtocols
>['route'];

beforeEach(() => {
  mockIsNative = true;
  mockWidth = 0;
  mockGtSm = false;
  mockGtMd = false;
  mockTableProps = undefined;
});

it('keeps native Simple Earn order through wide header, sort control and resize', async () => {
  render(<EarnProtocols route={route} />);
  await waitFor(() =>
    expect(screen.getByTestId('protocol-table').textContent).toContain(
      'Range,Flat',
    ),
  );
  const layout = screen.getByTestId('earn-content-layout');
  mockWidth = 768;
  fireEvent.click(layout);
  expect(mockTableProps?.tableLayout).toBe(true);
  expect(
    mockTableProps?.columns.find((column) => column.key === 'yield')
      ?.comparator,
  ).toBeUndefined();
  fireEvent.click(screen.getByText('TVL header'));
  expect(screen.getByTestId('protocol-table').textContent).toContain(
    'Flat,Range',
  );
  fireEvent.click(screen.getByText('Yield control'));
  expect(screen.getByTestId('protocol-table').textContent).toContain(
    'Range,Flat',
  );
  mockWidth = 767;
  fireEvent.click(layout);
  expect(mockTableProps?.tableLayout).toBe(false);
  expect(screen.getByTestId('protocol-table').textContent).toContain(
    'Range,Flat',
  );
});

it('leaves the Web 640–767 TableList default layout decision intact', async () => {
  mockIsNative = false;
  mockGtSm = true;
  mockGtMd = false;
  render(<EarnProtocols route={route} />);
  await waitFor(() => expect(mockTableProps).toBeDefined());
  expect(mockTableProps?.withHeader).toBe(true);
  expect(mockTableProps?.tableLayout).toBeUndefined();
});
