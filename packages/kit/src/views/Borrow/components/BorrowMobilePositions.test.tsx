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
  // The collateral slot puts its words in an accessibility label, so this one
  // has to survive the mock.
  function MockAccessibleStack({
    children,
    testID,
    accessibilityLabel,
  }: {
    children?: React.ReactNode;
    testID?: string;
    accessibilityLabel?: string;
  }) {
    return React.createElement(
      'div',
      { 'data-testid': testID, 'aria-label': accessibilityLabel },
      children,
    );
  }
  MockAccessibleStack.displayName = 'MockAccessibleStack';
  return {
    __esModule: true,
    ESwitchSize: { extraSmall: 'extraSmall', small: 'small', large: 'large' },
    SizableText: passthrough('span'),
    Skeleton: passthrough('div'),
    Stack: MockAccessibleStack,
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

jest.mock('../BorrowProvider', () => {
  const scope = {
    networkId: 'evm--1',
    marketAddress: '0xMarket',
    accountId: 'account-1',
  };
  (globalThis as Record<string, unknown>).__mobilePositionScope = scope;
  return {
    __esModule: true,
    useBorrowContext: () => ({
      reserves: { data: { supply: { assets: [] }, borrow: { assets: [] } } },
      market: {
        networkId: scope.networkId,
        provider: 'aave',
        marketAddress: scope.marketAddress,
        logoURI: 'https://example.com/aave.png',
      },
      borrowDataStatus: {},
      earnAccount: { data: { account: { id: scope.accountId } } },
    }),
  };
});

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

jest.mock('./BorrowTableList/CollateralBadge', () => ({
  __esModule: true,
  CollateralBadge: ({
    canBeCollateral,
    bg,
  }: {
    canBeCollateral?: boolean;
    bg?: string;
  }) => (
    <span
      data-testid="collateral-badge"
      data-can={String(canBeCollateral)}
      data-bg={bg}
    />
  ),
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
    collateral,
  }: {
    testID?: string;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    collateral?: React.ReactNode;
  }) => (
    <div>
      <button
        type="button"
        aria-label={testID}
        data-testid={testID}
        data-expanded={isExpanded ? 'true' : 'false'}
        onClick={onToggleExpand}
      />
      <div data-testid={`${testID ?? ''}-collateral`}>{collateral}</div>
    </div>
  ),
}));

import { fireEvent, render } from '@testing-library/react';

import { BorrowMobilePositions } from './BorrowMobilePositions';

const entries = (globalThis as Record<string, unknown>)
  .__mobilePositionEntries as unknown[];
const scope = (globalThis as Record<string, unknown>).__mobilePositionScope as {
  networkId: string;
  marketAddress: string;
  accountId: string;
};

function buildEntry(
  kind: 'supplied' | 'borrowed',
  reserveAddress: string,
  assetOverrides: Record<string, unknown> = {},
) {
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
            canBeCollateral: true,
            withdrawButton: {},
          }
        : { borrowedAmount: amount, repayButton: {} }),
      ...assetOverrides,
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
    scope.networkId = 'evm--1';
    scope.marketAddress = '0xMarket';
    scope.accountId = 'account-1';
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

  // Aave native reserves have an empty reserveAddress, and the list is not
  // remounted when the market or account changes, so an unscoped key would
  // leave the next market's native card pre-expanded.
  it('does not carry a native position open across a market switch', () => {
    entries.length = 0;
    entries.push(buildEntry('supplied', ''));
    const { getByTestId, rerender } = render(<BorrowMobilePositions />);

    fireEvent.click(getByTestId(cardId('supplied', '')));
    expect(
      getByTestId(cardId('supplied', '')).getAttribute('data-expanded'),
    ).toBe('true');

    scope.networkId = 'evm--8453';
    scope.marketAddress = '0xOtherMarket';
    rerender(<BorrowMobilePositions />);

    expect(
      getByTestId(cardId('supplied', '')).getAttribute('data-expanded'),
    ).toBe('false');
  });

  it('does not carry a position open across an account switch', () => {
    const { getByTestId, rerender } = render(<BorrowMobilePositions />);

    fireEvent.click(getByTestId(cardId('supplied', '0xAaa')));
    scope.accountId = 'account-2';
    rerender(<BorrowMobilePositions />);

    expect(
      getByTestId(cardId('supplied', '0xAaa')).getAttribute('data-expanded'),
    ).toBe('false');
  });

  it('keeps the open card open when the indexer changes address casing', () => {
    const { getByTestId, rerender } = render(<BorrowMobilePositions />);

    fireEvent.click(getByTestId(cardId('supplied', '0xAaa')));

    entries.length = 0;
    entries.push(
      buildEntry('supplied', '0xAAA'),
      buildEntry('borrowed', '0xBbb'),
    );
    rerender(<BorrowMobilePositions />);

    expect(
      getByTestId(cardId('supplied', '0xAAA')).getAttribute('data-expanded'),
    ).toBe('true');
  });
});

describe('BorrowMobilePositions collateral state', () => {
  const collateralSlot = (reserveAddress: string) =>
    `${cardId('supplied', reserveAddress)}-collateral`;

  function renderSupplied(assetOverrides: Record<string, unknown>) {
    entries.length = 0;
    entries.push(buildEntry('supplied', '0xAaa', assetOverrides));
    return render(<BorrowMobilePositions />);
  }

  it('keeps the switch for a position that is already collateral', () => {
    const { queryByTestId } = renderSupplied({
      usageAsCollateral: true,
      canBeCollateral: true,
    });

    expect(queryByTestId('collateral-switch')).not.toBeNull();
    expect(queryByTestId('collateral-badge')).toBeNull();
  });

  it('keeps the switch for a position that is off but still eligible', () => {
    const { queryByTestId } = renderSupplied({
      usageAsCollateral: false,
      canBeCollateral: true,
    });

    expect(queryByTestId('collateral-switch')).not.toBeNull();
  });

  // A switch that can never move is a false affordance.
  it('replaces the switch with the kit dash mark when the market never accepts the asset', () => {
    const { getByTestId, queryByTestId } = renderSupplied({
      usageAsCollateral: false,
      canBeCollateral: false,
    });

    expect(queryByTestId('collateral-switch')).toBeNull();
    expect(getByTestId('collateral-badge').getAttribute('data-can')).toBe(
      'false',
    );
  });

  // The chip's default fill is $bgSubdued, which is this card's own fill: the
  // container would render at 1.00:1 and vanish.
  it('gives the chip a fill that survives the card it sits on', () => {
    const { getByTestId } = renderSupplied({
      usageAsCollateral: false,
      canBeCollateral: false,
    });

    expect(getByTestId('collateral-badge').getAttribute('data-bg')).toBe(
      '$bgStrong',
    );
  });

  // The mark is silent on screen, so the state has to survive in the
  // accessibility tree.
  it('spells the state out for screen readers instead of on screen', () => {
    const { getByTestId } = renderSupplied({
      usageAsCollateral: false,
      canBeCollateral: false,
    });
    const slot = getByTestId(
      'borrow-position-card-collateral-unavailable-0xaaa',
    );

    expect(slot.getAttribute('aria-label')).toBe(
      'USDC, defi_collateral, global_not_available',
    );
    expect(slot.textContent).toBe('');
  });

  it('keeps the switch when the eligibility flag is missing', () => {
    const { queryByTestId } = renderSupplied({
      usageAsCollateral: false,
      canBeCollateral: undefined,
    });

    expect(queryByTestId('collateral-switch')).not.toBeNull();
    expect(queryByTestId('collateral-badge')).toBeNull();
  });

  it('renders no collateral slot when the provider has no such control', () => {
    const { getByTestId } = renderSupplied({
      usageAsCollateral: undefined,
      canBeCollateral: undefined,
    });

    expect(getByTestId(collateralSlot('0xAaa')).textContent).toBe('');
  });
});
