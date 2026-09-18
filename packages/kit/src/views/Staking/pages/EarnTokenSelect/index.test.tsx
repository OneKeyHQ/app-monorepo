/** @jest-environment jsdom */

/* eslint-disable import/first */

import type { ReactNode } from 'react';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Page = Object.assign(Box, {
    Body: Box,
    Header: Box,
  });
  const ListView = ({
    data,
    renderItem,
  }: {
    data: unknown[];
    renderItem: ({ item }: { item: unknown }) => ReactNode;
  }) => (
    <div>
      {data.map((item, index) => (
        <React.Fragment key={index}>{renderItem({ item })}</React.Fragment>
      ))}
    </div>
  );
  return {
    ListView,
    NumberSizeableText: ({
      children,
      formatter,
      formatterOptions,
    }: {
      children?: ReactNode;
      formatter?: string;
      formatterOptions?: { currency?: string };
    }) => (
      <span
        data-currency={formatterOptions?.currency}
        data-formatter={formatter}
        data-testid={formatter === 'value' ? 'fiat-value' : 'balance-value'}
      >
        {children}
      </span>
    ),
    Page,
    SizableText: Box,
    Skeleton: Box,
    Stack: Box,
    XStack: Box,
    YStack: Box,
    useSafeAreaInsets: () => ({ bottom: 0 }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getEarnAssetsList: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pop: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => ({
    params: {
      accountId: 'account-1',
      networkId: 'evm--1',
      provider: 'pendle',
      symbol: 'ETH',
      action: 'stake',
    },
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: {
      assets: [
        {
          balance: '1',
          balanceParsed: '1',
          fiatValue: '3136.88',
          price: '3136.88',
          price24h: '3136.88',
          info: {
            address: '0xasset',
            isNative: false,
            logoURI: '',
            name: 'Tether',
            symbol: 'USDT',
          },
        },
      ],
    },
    isLoading: false,
  }),
}));

const mockSettingsState: { symbol: string } = { symbol: '¥' };
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [
    { currencyInfo: { id: 'cny', symbol: mockSettingsState.symbol } },
  ],
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy(
    {},
    {
      get: (_target, property) => property,
    },
  ),
}));

import EarnTokenSelectModal from '.';

import { render, screen } from '@testing-library/react';

describe('EarnTokenSelectModal fiat value', () => {
  afterEach(() => {
    mockSettingsState.symbol = '¥';
  });

  it('passes the selected currency to the fiat formatter', () => {
    render(<EarnTokenSelectModal />);

    const fiatValue = screen.getByTestId('fiat-value');
    expect(fiatValue.textContent).toBe('3136.88');
    expect(fiatValue.getAttribute('data-currency')).toBe('¥');
    expect(fiatValue.getAttribute('data-formatter')).toBe('value');
  });

  it('updates the symbol when the settings currency changes', () => {
    const { rerender } = render(<EarnTokenSelectModal />);

    mockSettingsState.symbol = '€';
    rerender(<EarnTokenSelectModal />);

    const fiatValue = screen.getByTestId('fiat-value');
    expect(fiatValue.textContent).toBe('3136.88');
    expect(fiatValue.getAttribute('data-currency')).toBe('€');
    expect(fiatValue.getAttribute('data-formatter')).toBe('value');
  });
});
