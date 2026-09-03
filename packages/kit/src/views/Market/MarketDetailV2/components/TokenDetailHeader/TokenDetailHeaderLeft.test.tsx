/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { TokenDetailHeaderLeft } from './TokenDetailHeaderLeft';

let mockMd = false;

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);

  return {
    Divider: Container,
    InteractiveIcon: ({ testID }: { testID?: string }) =>
      React.createElement('button', { 'data-testid': testID }),
    SizableText: Container,
    XStack: Container,
    YStack: Container,
    useMedia: () => ({ md: mockMd }),
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useNetworkLogoUri', () => ({
  useNetworkLogoUri: () => '',
}));

jest.mock('@onekeyhq/shared/src/logger/scopes/dex', () => ({
  EWatchlistFrom: { Detail: 'Detail' },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { shortenAddress: () => '0x1234...5678' },
}));

jest.mock('../../../components/CommunityRecognizedBadge', () => ({
  CommunityRecognizedBadge: () => null,
}));

jest.mock('../../../components/MarketStarV2', () => ({
  MarketStarV2: () => null,
}));

jest.mock('../../../components/PerpsBadges', () => ({
  StockMarketStatusBadge: () => null,
  StockSourceLogo: () => null,
  SubtitleBadge: () => null,
}));

jest.mock('../../../components/TokenTagsPopover', () => ({
  TokenTagsPopover: () => null,
}));

jest.mock('../TokenSecurityAlert', () => ({
  TokenSecurityAlert: () => null,
}));

jest.mock('../TokenSelector/MarketTokenSelector', () => ({
  MarketTokenSelector: () => null,
}));

jest.mock('./hooks/useTokenDetailHeaderLeftActions', () => ({
  useTokenDetailHeaderLeftActions: () => ({
    handleCopyAddress: jest.fn(),
    handleOpenWebsite: jest.fn(),
    handleOpenTwitter: jest.fn(),
    handleOpenXSearch: jest.fn(),
  }),
}));

jest.mock('./ShareButton', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    ShareButton: ({ useIconButton }: { useIconButton?: boolean }) =>
      React.createElement('button', {
        'data-testid': useIconButton
          ? 'market-url-icon-btn'
          : 'market-url-icon',
      }),
  };
});

const tokenDetail = {
  symbol: 'AI',
  address: '0x1234567890abcdef',
  extraData: {
    website: 'https://example.com',
    twitter: 'https://x.com/example',
  },
} as IMarketTokenDetail;

describe('TokenDetailHeaderLeft share button layout', () => {
  beforeEach(() => {
    mockMd = false;
  });

  test('renders only the outer share button in the desktop redesign', () => {
    const view = render(
      <TokenDetailHeaderLeft
        chartMode="native"
        tokenDetail={tokenDetail}
        networkId="evm--1"
        desktopRedesign
      />,
    );

    expect(view.queryAllByTestId('market-url-icon')).toHaveLength(0);
    expect(view.queryAllByTestId('market-url-icon-btn')).toHaveLength(1);
  });

  test('keeps the inline share button in the legacy desktop layout', () => {
    const view = render(
      <TokenDetailHeaderLeft
        chartMode="native"
        tokenDetail={tokenDetail}
        networkId="evm--1"
      />,
    );

    expect(view.queryAllByTestId('market-url-icon')).toHaveLength(1);
    expect(view.queryAllByTestId('market-url-icon-btn')).toHaveLength(0);
  });

  test('renders one outer share button for redesigned top coins', () => {
    const view = render(
      <TokenDetailHeaderLeft
        chartMode="native"
        tokenDetail={tokenDetail}
        networkId="evm--1"
        desktopRedesign
        desktopDetailVariant="topCoins"
      />,
    );

    expect(view.queryAllByTestId('market-url-icon')).toHaveLength(0);
    expect(view.queryAllByTestId('market-url-icon-btn')).toHaveLength(1);
  });
});
