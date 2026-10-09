/** @jest-environment jsdom */
// cspell:ignore Financials
import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { useTokenSecurity } from '../../TokenSecurityAlert/hooks';

import { MobileTopCoinsOverviewPanel } from './MobileDetailOverviewPanels';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const Box = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    Stack: Box,
    XStack: Box,
    SizableText: Box,
    Tabs: { ScrollView: Box },
  };
});
jest.mock('../../../hooks/useTokenDetail', () => ({
  useTokenDetail: jest.fn(),
}));
jest.mock('../../../hooks/StockDetailContext', () => ({
  useStockDetail: () => ({}),
}));
jest.mock('../../TokenSecurityAlert/hooks', () => ({
  useTokenSecurity: jest.fn(),
}));
jest.mock('../../TokenSecurityAlert/TokenSecurityAlert', () => ({
  TokenSecurityAlert: () => <button type="button">Audit results</button>,
}));
jest.mock('../../StockFinancials/StockFinancials', () => ({
  StockFinancials: () => null,
}));
jest.mock('../../TokenActivityOverview/TokenActivityOverview', () => ({
  TokenActivityOverview: () => null,
}));
jest.mock('../../TokenOverview/TokenOverview', () => ({
  TokenOverview: () => null,
}));
jest.mock('../../TokenSupplementaryInfo/TokenSupplementaryInfo', () => ({
  TokenSupplementaryInfo: () => null,
}));
jest.mock('../../TopCoinsOverview/TopCoinsOverviewContent', () => ({
  TopCoinsOverviewContent: () => null,
}));
jest.mock('../StockMobileOverview', () => ({
  StockMobileOverview: () => null,
}));

beforeEach(() => {
  jest.mocked(useTokenDetail).mockReturnValue({
    networkId: 'evm--1',
    tokenAddress: '0xabc',
  } as ReturnType<typeof useTokenDetail>);
  jest.mocked(useTokenSecurity).mockReturnValue({
    securityData: {},
    securityStatus: 'safe',
    riskCount: 0,
    cautionCount: 0,
    formattedData: [],
  });
});

it('keeps contract audit results accessible in the mobile top-coin overview', () => {
  render(<MobileTopCoinsOverviewPanel scrollEnabled />);
  expect(screen.getByRole('button', { name: 'Audit results' })).toBeTruthy();
  expect(useTokenSecurity).toHaveBeenCalledWith({
    networkId: 'evm--1',
    tokenAddress: '0xabc',
  });
});

it('keeps an audit placeholder while the result is loading', () => {
  jest.mocked(useTokenSecurity).mockReturnValue({
    securityData: null,
    securityStatus: null,
    riskCount: 0,
    cautionCount: 0,
    formattedData: [],
  });
  render(<MobileTopCoinsOverviewPanel scrollEnabled />);
  expect(
    screen.getByTestId('market-detail-security-row').textContent,
  ).toContain('--');
  expect(screen.queryByRole('button')).toBeNull();
});

it('does not offer contract audit for a native asset without an address', () => {
  jest
    .mocked(useTokenDetail)
    .mockReturnValue({ networkId: 'evm--1', tokenAddress: '' } as ReturnType<
      typeof useTokenDetail
    >);
  render(<MobileTopCoinsOverviewPanel scrollEnabled />);
  expect(screen.queryByTestId('market-detail-security-row')).toBeNull();
});
