/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { useMedia } from '@onekeyhq/components';

import { MarketDetailV2LoadingFallback } from './MarketDetailV2LoadingFallback';

jest.mock('@onekeyhq/components', () => {
  function MockContainer({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) {
    return <div data-testid={testID}>{children}</div>;
  }

  return {
    Page: {
      Header: () => <div data-testid="compact-page-header" />,
    },
    Spinner: () => <div data-testid="spinner" />,
    Stack: MockContainer,
    useMedia: jest.fn(),
  };
});

jest.mock(
  '../../../components/AccountSelector/AccountSelectorProvider',
  () => ({
    AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) => (
      <div data-testid="account-selector-mirror">{children}</div>
    ),
  }),
);

jest.mock('../../../components/TabPageHeader', () => ({
  TabPageHeader: () => <div data-testid="desktop-tab-header" />,
}));

describe('MarketDetailV2LoadingFallback', () => {
  it('renders a spinner without a desktop shell skeleton', () => {
    jest.mocked(useMedia).mockReturnValue({
      md: false,
      gtMd: true,
      gtLg: true,
    } as ReturnType<typeof useMedia>);

    render(<MarketDetailV2LoadingFallback />);

    expect(screen.getByTestId('desktop-tab-header')).toBeTruthy();
    expect(screen.getByTestId('spinner')).toBeTruthy();
    expect(screen.queryByTestId('market-detail-page-loading')).toBeNull();
  });

  it('renders a spinner without a compact shell skeleton', () => {
    jest.mocked(useMedia).mockReturnValue({
      md: true,
      gtMd: false,
      gtLg: false,
    } as ReturnType<typeof useMedia>);

    render(<MarketDetailV2LoadingFallback />);

    expect(screen.getByTestId('compact-page-header')).toBeTruthy();
    expect(screen.getByTestId('spinner')).toBeTruthy();
    expect(screen.queryByTestId('market-detail-page-loading')).toBeNull();
  });
});
