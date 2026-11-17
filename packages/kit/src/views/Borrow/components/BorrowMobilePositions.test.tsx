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

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    // A getter, so a case can move the component onto native mid-suite.
    get isRuntimeBrowser() {
      return (
        (globalThis as Record<string, unknown>).__isRuntimeBrowser !== false
      );
    },
  },
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
  // Forwards what the component emits rather than translating it. Rewriting
  // accessibilityLabel into aria-label here would keep passing for a mark that
  // reaches no browser accessibility tree at all: Tamagui renders stacks to a
  // div and maps none of the React Native accessibility props.
  function MockAccessibleStack({
    children,
    testID,
    ...rest
  }: {
    children?: React.ReactNode;
    testID?: string;
  } & Record<string, unknown>) {
    // Only these reach a real DOM node. The rest are React Native props that
    // Tamagui neither maps nor strips on web, so they would land there as
    // unknown attributes — park the whole set where a test can say so.
    (
      ((globalThis as Record<string, unknown>).__collateralSlotProps ??=
        []) as Record<string, unknown>[]
    ).push({ ...rest, testID });
    const forwarded = Object.fromEntries(
      Object.entries(rest).filter(
        ([key]) => key.startsWith('aria-') || key === 'role',
      ),
    );
    return React.createElement(
      'div',
      { 'data-testid': testID, ...forwarded },
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
    // Mirrors the real helper, which folds case on EVM only. A stub that
    // lowercased everything would fold two case-differing base58 addresses
    // together on the suite's behalf and report that as the component's doing.
    normalizeBorrowAddress: ({
      networkId,
      address,
    }: {
      networkId: string;
      address: string;
    }) => (networkId.startsWith('evm--') ? address.toLowerCase() : address),
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
  isBorrowReservesPending: () =>
    (
      (globalThis as Record<string, unknown>).__mobilePositionScope as
        | { reservesPending?: boolean }
        | undefined
    )?.reservesPending === true,
}));

jest.mock('../BorrowProvider', () => {
  const scope = {
    networkId: 'evm--1',
    marketAddress: '0xMarket',
    accountId: 'account-1',
    earnAccountLoading: false,
    reservesPending: false,
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
      earnAccount: {
        data: scope.accountId ? { account: { id: scope.accountId } } : null,
        loading: scope.earnAccountLoading,
      },
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
    unavailableBg,
  }: {
    canBeCollateral?: boolean;
    unavailableBg?: string;
  }) => (
    <span
      data-testid="collateral-badge"
      data-can={String(canBeCollateral)}
      data-bg={unavailableBg}
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
    actions,
  }: import('./BorrowPositionCard').IBorrowPositionCardProps) => {
    // Every render, not just the last. A correction that lands in an effect
    // leaves the same final state as one that never renders wrong, so the
    // sequence is the only place the difference shows up.
    (
      ((globalThis as Record<string, unknown>).__expansionRenders ??=
        []) as string[]
    ).push(`${testID ?? ''}=${isExpanded ? 'true' : 'false'}`);
    return (
      <div>
        <button
          type="button"
          aria-label={testID}
          data-testid={testID}
          data-expanded={isExpanded ? 'true' : 'false'}
          onClick={onToggleExpand}
        />
        <div data-testid={`${testID ?? ''}-collateral`}>{collateral}</div>
        {isExpanded
          ? actions.map((action) => (
              <button
                key={action.key}
                type="button"
                data-testid={action.testID}
                disabled={action.disabled}
                onClick={action.onPress}
              >
                {action.label}
              </button>
            ))
          : null}
      </div>
    );
  },
}));

import { fireEvent, render } from '@testing-library/react';

import { BorrowMobilePositions } from './BorrowMobilePositions';

const { BorrowNavigation: navigationMock } = jest.requireMock<{
  BorrowNavigation: { pushToBorrowManagePosition: jest.Mock<void, unknown[]> };
}>('../borrowUtils');
const entries = (globalThis as Record<string, unknown>)
  .__mobilePositionEntries as unknown[];
const scope = (globalThis as Record<string, unknown>).__mobilePositionScope as {
  networkId: string;
  marketAddress: string;
  accountId: string;
  earnAccountLoading: boolean;
  reservesPending: boolean;
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

describe('BorrowMobilePositions actions', () => {
  beforeEach(() => {
    entries.length = 0;
    jest.clearAllMocks();
  });

  it.each([
    ['supplied', 'withdraw'],
    ['supplied', 'supply'],
    ['borrowed', 'repay'],
    ['borrowed', 'borrow'],
  ] as const)('opens %s %s for the tapped reserve', (kind, action) => {
    entries.push(buildEntry(kind, '0xAaa'));
    const { getByTestId } = render(<BorrowMobilePositions />);

    fireEvent.click(getByTestId(cardId(kind, '0xAaa')));
    fireEvent.click(
      getByTestId(`borrow-position-card-${action}-btn-${kind}-0xaaa`),
    );

    expect(navigationMock.pushToBorrowManagePosition).toHaveBeenCalledTimes(1);
    expect(navigationMock.pushToBorrowManagePosition).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        accountId: scope.accountId,
        networkId: scope.networkId,
        marketAddress: scope.marketAddress,
        reserveAddress: '0xAaa',
        type: action,
      }),
    );
  });

  it.each([
    ['supplied', 'withdraw', 'withdrawButton'],
    ['borrowed', 'repay', 'repayButton'],
  ] as const)('blocks a disabled %s %s', (kind, action, buttonKey) => {
    entries.push(
      buildEntry(kind, '0xAaa', { [buttonKey]: { disabled: true } }),
    );
    const { getByTestId } = render(<BorrowMobilePositions />);

    fireEvent.click(getByTestId(cardId(kind, '0xAaa')));
    const button = getByTestId(
      `borrow-position-card-${action}-btn-${kind}-0xaaa`,
    );
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);

    expect(navigationMock.pushToBorrowManagePosition).not.toHaveBeenCalled();
  });
});

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
    scope.earnAccountLoading = false;
    scope.reservesPending = false;
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

  // A blank accountId is a loading frame, not a different account: the gate
  // publishes data: null whenever the derive scope resets or a market switch is
  // cancelled, with the component still mounted. Clearing on it turns what used
  // to be a self-healing flicker into permanent loss of the user's expansion.
  it('keeps the card expanded across a transient blank accountId', () => {
    const { getByTestId, rerender } = render(<BorrowMobilePositions />);
    const positionId = cardId('supplied', '0xAaa');

    fireEvent.click(getByTestId(positionId));
    expect(getByTestId(positionId).getAttribute('data-expanded')).toBe('true');

    scope.accountId = '';
    scope.earnAccountLoading = true;
    rerender(<BorrowMobilePositions />);

    // The same account resolves back; nothing about the scope actually moved.
    scope.accountId = 'account-1';
    scope.earnAccountLoading = false;
    rerender(<BorrowMobilePositions />);

    expect(getByTestId(positionId).getAttribute('data-expanded')).toBe('true');
  });

  // The blank must not swallow a real switch either. Every real account switch
  // blanks, so the path is account-1 -> '' -> account-2 -> '' -> account-1, and
  // scoped keys already hide account-1's card while account-2 is showing. Only
  // the return leg proves the reset ran: skip it on either switch and the stale
  // key is still held, so coming back pops the card open on its own.
  it('drops the open card when a blank resolves into a different account', () => {
    const { getByTestId, rerender } = render(<BorrowMobilePositions />);
    const positionId = cardId('supplied', '0xAaa');
    const blankThenResolve = (accountId: string) => {
      scope.accountId = '';
      scope.earnAccountLoading = true;
      rerender(<BorrowMobilePositions />);
      scope.accountId = accountId;
      scope.earnAccountLoading = false;
      rerender(<BorrowMobilePositions />);
    };

    fireEvent.click(getByTestId(positionId));
    expect(getByTestId(positionId).getAttribute('data-expanded')).toBe('true');

    blankThenResolve('account-2');
    expect(getByTestId(positionId).getAttribute('data-expanded')).toBe('false');

    blankThenResolve('account-1');
    expect(getByTestId(positionId).getAttribute('data-expanded')).toBe('false');
  });

  it.each([
    { accountId: 'account-2' },
    { marketAddress: '0xOtherMarket' },
    { networkId: 'evm--8453' },
  ])(
    'keeps the original card collapsed after a scope round-trip: %j',
    (nextScope) => {
      const originalScope = { ...scope };
      const { getByTestId, rerender } = render(<BorrowMobilePositions />);
      const positionId = cardId('supplied', '0xAaa');

      fireEvent.click(getByTestId(positionId));
      expect(getByTestId(positionId).getAttribute('data-expanded')).toBe(
        'true',
      );

      Object.assign(scope, nextScope);
      rerender(<BorrowMobilePositions />);
      expect(getByTestId(positionId).getAttribute('data-expanded')).toBe(
        'false',
      );

      Object.assign(scope, originalScope);
      rerender(<BorrowMobilePositions />);
      expect(getByTestId(positionId).getAttribute('data-expanded')).toBe(
        'false',
      );

      fireEvent.click(getByTestId(positionId));
      expect(getByTestId(positionId).getAttribute('data-expanded')).toBe(
        'true',
      );
    },
  );

  // The reset already sits out these frames. The key used to undo that on its
  // own: a blank account made a new key, which remounted the card collapsed
  // and then remounted it again on the way back.
  it('keeps the card mounted and open through the blank frame itself', () => {
    const { getByTestId, rerender } = render(<BorrowMobilePositions />);
    const positionId = cardId('supplied', '0xAaa');

    fireEvent.click(getByTestId(positionId));
    const beforeBlank = getByTestId(positionId);

    scope.accountId = '';
    scope.earnAccountLoading = true;
    rerender(<BorrowMobilePositions />);

    const duringBlank = getByTestId(positionId);
    expect(duringBlank).toBe(beforeBlank);
    expect(duringBlank.getAttribute('data-expanded')).toBe('true');
  });

  // Base58 is case-sensitive, so two Solana markets can differ by case alone.
  // Folding them together would hand the next market the previous one's open
  // card, and the reset that should have caught it compares the same value.
  it('treats case-differing Solana markets as separate scopes', () => {
    scope.networkId = 'sol--101';
    scope.marketAddress = 'MarketAaa';
    const { getByTestId, rerender } = render(<BorrowMobilePositions />);
    const positionId = cardId('supplied', '0xAaa');

    fireEvent.click(getByTestId(positionId));
    expect(getByTestId(positionId).getAttribute('data-expanded')).toBe('true');

    scope.marketAddress = 'MARKETAAA';
    rerender(<BorrowMobilePositions />);

    expect(getByTestId(positionId).getAttribute('data-expanded')).toBe('false');
  });

  // Withdrawing or repaying a position to zero removes it. Holding its key
  // would re-open the card on its own if the asset came back.
  it('forgets a position that left the list for good', () => {
    const { getByTestId, queryByTestId, rerender } = render(
      <BorrowMobilePositions />,
    );
    const positionId = cardId('supplied', '0xAaa');

    fireEvent.click(getByTestId(positionId));
    expect(getByTestId(positionId).getAttribute('data-expanded')).toBe('true');

    const saved = [...entries];
    entries.length = 0;
    entries.push(buildEntry('borrowed', '0xBbb'));
    rerender(<BorrowMobilePositions />);
    expect(queryByTestId(positionId)).toBeNull();

    entries.length = 0;
    saved.forEach((entry) => entries.push(entry));
    rerender(<BorrowMobilePositions />);

    expect(getByTestId(positionId).getAttribute('data-expanded')).toBe('false');
  });

  // The other direction, and the reason that reset waits for settled data: an
  // empty list mid-refresh is not a position going away.
  it('keeps the card open across a refresh that empties the list', () => {
    const { getByTestId, rerender } = render(<BorrowMobilePositions />);
    const positionId = cardId('supplied', '0xAaa');

    fireEvent.click(getByTestId(positionId));

    const saved = [...entries];
    entries.length = 0;
    scope.reservesPending = true;
    rerender(<BorrowMobilePositions />);

    scope.reservesPending = false;
    saved.forEach((entry) => entries.push(entry));
    rerender(<BorrowMobilePositions />);

    expect(getByTestId(positionId).getAttribute('data-expanded')).toBe('true');
  });

  // The key names the position alone, so the same asset under the next account
  // matches whatever key is open. Correcting that after the fact would still
  // put one expanded frame on screen, under a scope the user already left.
  it('never renders the next scope expanded, not even for one frame', () => {
    const { getByTestId, rerender } = render(<BorrowMobilePositions />);
    const positionId = cardId('supplied', '0xAaa');

    fireEvent.click(getByTestId(positionId));
    (globalThis as Record<string, unknown>).__expansionRenders = [];

    // Same reserve, next account: identical position key.
    scope.accountId = 'account-2';
    rerender(<BorrowMobilePositions />);

    const renders = (
      (globalThis as Record<string, unknown>).__expansionRenders as string[]
    ).filter((entry) => entry.startsWith(`${positionId}=`));
    expect(renders.length).toBeGreaterThan(0);
    expect(renders).not.toContain(`${positionId}=true`);
  });

  it('keeps the open card open when the indexer changes address casing', () => {
    const { getByTestId, rerender } = render(<BorrowMobilePositions />);

    fireEvent.click(getByTestId(cardId('supplied', '0xAaa')));

    entries.length = 0;
    entries.push(
      buildEntry('supplied', '0xAAA'),
      buildEntry('borrowed', '0xBbb'),
    );
    scope.marketAddress = '0xMARKET';
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
    (globalThis as Record<string, unknown>).__collateralSlotProps = [];
    return render(<BorrowMobilePositions />);
  }

  // The unavailable mark's full prop set, DOM-bound and otherwise.
  const markProps = () =>
    (
      ((globalThis as Record<string, unknown>).__collateralSlotProps ??
        []) as Record<string, unknown>[]
    ).find(
      (p) => p.testID === 'borrow-position-card-collateral-unavailable-0xaaa',
    ) ?? {};

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
  // accessibility tree. On web, desktop and the extension that means the aria
  // twins: the React Native props alone reach the DOM as unknown attributes.
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
    // A bare div drops aria-label under ARIA naming rules.
    expect(slot.getAttribute('role')).toBe('img');
    expect(slot.textContent).toBe('');

    // And nothing the browser cannot use. These never become attributes a
    // screen reader reads; they only reach the DOM as unknown ones.
    expect(markProps()).toMatchObject({ 'aria-label': expect.any(String) });
    expect(markProps()).not.toHaveProperty('accessible');
    expect(markProps()).not.toHaveProperty('accessibilityRole');
    expect(markProps()).not.toHaveProperty('accessibilityLabel');
  });

  it('leaves the DOM-only props off the mark on native', () => {
    (globalThis as Record<string, unknown>).__isRuntimeBrowser = false;
    try {
      const { getByTestId } = renderSupplied({
        usageAsCollateral: false,
        canBeCollateral: false,
      });
      const slot = getByTestId(
        'borrow-position-card-collateral-unavailable-0xaaa',
      );

      expect(slot.getAttribute('aria-label')).toBeNull();
      expect(slot.getAttribute('role')).toBeNull();
      expect(markProps()).toMatchObject({
        accessible: true,
        accessibilityRole: 'text',
        accessibilityLabel: 'USDC, defi_collateral, global_not_available',
      });
      expect(markProps()).not.toHaveProperty('role');
      expect(markProps()).not.toHaveProperty('aria-label');
    } finally {
      delete (globalThis as Record<string, unknown>).__isRuntimeBrowser;
    }
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
