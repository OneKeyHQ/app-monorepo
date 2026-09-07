/** @jest-environment jsdom */
/* eslint-disable import/first */

// apps/cli/src/__mocks__/react-native.js is a node-module manual mock, so jest
// auto-applies that CLI shim repo-wide and it carries no StyleSheet.
jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 0.33 },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const passthrough = (tag: string) => {
    function MockStack({ children }: { children?: React.ReactNode }) {
      return React.createElement(tag, null, children);
    }
    MockStack.displayName = `MockStack(${tag})`;
    return MockStack;
  };
  return {
    __esModule: true,
    ESwitchSize: { extraSmall: 'extraSmall', small: 'small', large: 'large' },
    SizableText: passthrough('span'),
    Skeleton: passthrough('div'),
    XStack: passthrough('div'),
    YStack: passthrough('div'),
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy(
    {},
    {
      get: (_target, property) => property,
    },
  ),
}));

jest.mock('@onekeyhq/shared/src/utils/earnUtils', () => ({
  __esModule: true,
  default: {
    normalizeBorrowAddress: ({ address }: { address: string }) =>
      address.toLowerCase(),
  },
}));

jest.mock('@onekeyhq/shared/types/staking', () => ({
  __esModule: true,
  EManagePositionType: {
    Supply: 'supply',
    Withdraw: 'withdraw',
    Borrow: 'borrow',
    Repay: 'repay',
  },
}));

jest.mock('../borrowDataStatus', () => ({
  __esModule: true,
  isBorrowReservesPending: () => false,
}));

jest.mock('../BorrowProvider', () => ({
  __esModule: true,
  useBorrowContext: () => ({
    reserves: { data: { supply: { assets: [] }, borrow: { assets: [] } } },
    market: {
      networkId: 'evm--1',
      provider: 'aave',
      marketAddress: '0xMarket',
      logoURI: 'https://example.com/aave.png',
    },
    borrowDataStatus: {},
    earnAccount: { data: { account: { id: 'account-1' } } },
  }),
}));

jest.mock('../borrowUtils', () => ({
  __esModule: true,
  BorrowNavigation: { pushToBorrowManagePosition: jest.fn() },
}));

jest.mock('./borrowRepayPosition.utils', () => ({
  __esModule: true,
  isUnsupportedAaveNativeReserve: () => false,
}));

jest.mock('./CollateralSwitchCell', () => ({
  __esModule: true,
  CollateralSwitchCell: () => <span data-testid="collateral-switch" />,
}));

jest.mock('../hooks/useBorrowPositionEntries', () => {
  const entries: unknown[] = [];
  (globalThis as Record<string, unknown>).__mobilePositionEntries = entries;
  return {
    __esModule: true,
    useBorrowPositionEntries: () => entries,
  };
});

// Stand in for the card so the suite asserts the list's open/closed bookkeeping
// rather than re-testing the card's own rendering.
jest.mock('./BorrowPositionCard', () => ({
  __esModule: true,
  BorrowPositionCard: ({
    testID,
    isExpanded,
    onToggleExpand,
  }: {
    testID?: string;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
  }) => (
    <button
      type="button"
      aria-label={testID}
      data-testid={testID}
      data-expanded={isExpanded ? 'true' : 'false'}
      onClick={onToggleExpand}
    />
  ),
}));

import { fireEvent, render } from '@testing-library/react';

import { BorrowMobilePositions } from './BorrowMobilePositions';

const entries = (globalThis as Record<string, unknown>)
  .__mobilePositionEntries as unknown[];

function buildEntry(kind: 'supplied' | 'borrowed', reserveAddress: string) {
  const amount = { title: { text: '20' }, description: { text: '$20' } };
  return {
    kind,
    fiatValue: '20',
    asset: {
      reserveAddress,
      token: {
        networkId: 'evm--1',
        address: reserveAddress,
        logoURI: 'https://example.com/token.png',
        name: 'Token',
        symbol: 'USDC',
        decimals: 6,
      },
      apyDetail: { apy: '3.78%' },
      categories: [],
      ...(kind === 'supplied'
        ? {
            suppliedAmount: amount,
            usageAsCollateral: true,
            withdrawButton: {},
          }
        : { borrowedAmount: amount, repayButton: {} }),
    },
  };
}

const cardId = (kind: 'supplied' | 'borrowed', reserveAddress: string) =>
  `borrow-position-card-${kind}-${reserveAddress.toLowerCase()}`;

describe('BorrowMobilePositions expand bookkeeping', () => {
  beforeEach(() => {
    entries.length = 0;
    entries.push(
      buildEntry('supplied', '0xAaa'),
      buildEntry('borrowed', '0xBbb'),
    );
  });

  it('starts with every card collapsed', () => {
    const { getByTestId } = render(<BorrowMobilePositions />);

    expect(
      getByTestId(cardId('supplied', '0xAaa')).getAttribute('data-expanded'),
    ).toBe('false');
    expect(
      getByTestId(cardId('borrowed', '0xBbb')).getAttribute('data-expanded'),
    ).toBe('false');
  });

  it('collapses the open card when another one is tapped', () => {
    const { getByTestId } = render(<BorrowMobilePositions />);

    fireEvent.click(getByTestId(cardId('supplied', '0xAaa')));

    expect(
      getByTestId(cardId('supplied', '0xAaa')).getAttribute('data-expanded'),
    ).toBe('true');

    fireEvent.click(getByTestId(cardId('borrowed', '0xBbb')));

    expect(
      getByTestId(cardId('supplied', '0xAaa')).getAttribute('data-expanded'),
    ).toBe('false');
    expect(
      getByTestId(cardId('borrowed', '0xBbb')).getAttribute('data-expanded'),
    ).toBe('true');
  });

  it('collapses the open card when it is tapped again', () => {
    const { getByTestId } = render(<BorrowMobilePositions />);

    fireEvent.click(getByTestId(cardId('supplied', '0xAaa')));
    fireEvent.click(getByTestId(cardId('supplied', '0xAaa')));

    expect(
      getByTestId(cardId('supplied', '0xAaa')).getAttribute('data-expanded'),
    ).toBe('false');
  });

  it('keeps same-address supplied and borrowed positions independent', () => {
    entries.length = 0;
    entries.push(
      buildEntry('supplied', '0xSame'),
      buildEntry('borrowed', '0xSame'),
    );
    const { getByTestId } = render(<BorrowMobilePositions />);

    fireEvent.click(getByTestId(cardId('supplied', '0xSame')));

    expect(
      getByTestId(cardId('supplied', '0xSame')).getAttribute('data-expanded'),
    ).toBe('true');
    expect(
      getByTestId(cardId('borrowed', '0xSame')).getAttribute('data-expanded'),
    ).toBe('false');
  });
});
