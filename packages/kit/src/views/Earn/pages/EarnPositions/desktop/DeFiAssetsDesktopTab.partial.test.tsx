/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { DeFiAssetsDesktopTab } from './DeFiAssetsDesktopTab';

import type { IEarnProtocolView } from '../mobile/earnPositionModel';

jest.mock('@onekeyhq/components', () => ({
  Empty: () => <div>empty</div>,
  Spinner: () => <div>loading</div>,
  Stack: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  YStack: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => '' }),
}));
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ symbol: '$' }),
}));
jest.mock('@onekeyhq/kit/src/components/DeFi/ProtocolValueCell', () => ({
  ProtocolValueCell: () => null,
}));
jest.mock('../mobile/GroupRow', () => ({
  GroupRow: ({
    name,
    children,
  }: {
    name: string;
    children: React.ReactNode;
  }) => (
    <div>
      {name}
      {children}
    </div>
  ),
  useGroupExpansion: () => ({ isExpanded: () => true, open: () => undefined }),
}));
jest.mock('../mobile/useRepeatedProtocolNetworkNames', () => ({
  useRepeatedProtocolNetworkNames: () => new Map(),
}));
jest.mock('../useCardFocus', () => ({
  useCardFocus: () => ({
    flashKeys: new Set(),
    registerAnchor: () => undefined,
    scrollToCards: () => undefined,
  }),
  useFocusRequestOnce: () => undefined,
}));
jest.mock('./EarnPortfolioOverview', () => ({
  EarnPortfolioOverview: () => <div>total overview</div>,
}));
jest.mock('./EarnPositionDesktopBlock', () => ({
  EarnPositionDesktopBlock: () => <div>position</div>,
}));

it('shows available protocols during an incomplete read without showing a partial total', () => {
  const protocol: IEarnProtocolView = {
    key: 'aave:evm--1',
    name: 'Aave',
    protocol: 'aave',
    networkId: 'evm--1',
    value: { value: 1, hasAvailableValue: true, hasUnavailableValue: false },
    positions: [],
  };
  const props = {
    protocols: [protocol],
    pendingCountByProvider: {},
    onManage: () => undefined,
    onRedeem: () => undefined,
  };
  const view = render(<DeFiAssetsDesktopTab {...props} isLoading />);
  expect(screen.getByText('Aave')).toBeTruthy();
  expect(screen.getByText('loading')).toBeTruthy();
  expect(screen.queryByText('total overview')).toBeNull();
  view.rerender(<DeFiAssetsDesktopTab {...props} isLoading={false} />);
  expect(screen.getByText('total overview')).toBeTruthy();
  view.rerender(
    <DeFiAssetsDesktopTab {...props} isLoading={false} isUnavailable />,
  );
  expect(screen.getByText('Aave')).toBeTruthy();
  expect(screen.queryByText('loading')).toBeNull();
  expect(screen.queryByText('total overview')).toBeNull();
});

it('does not show empty or loading when the market data is unavailable', () => {
  render(
    <DeFiAssetsDesktopTab
      protocols={[]}
      pendingCountByProvider={{}}
      isLoading={false}
      isUnavailable
    />,
  );
  expect(screen.queryByText('loading')).toBeNull();
  expect(screen.queryByText('empty')).toBeNull();
  expect(screen.queryByText('total overview')).toBeNull();
});
