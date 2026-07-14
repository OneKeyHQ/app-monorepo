import type {
  IBorrowEModeAsset,
  IBorrowEModeBlockerAsset,
  IBorrowEModeSwitchCheck,
} from '@onekeyhq/shared/types/staking';

import {
  buildEModeRows,
  buildEModeSelectDescription,
  buildNeedActionItems,
  isEModeBorrowActionTag,
  isEModeFocusActivationPending,
  isEModePendingGuardActive,
  normalizeEModeLabel,
  reconcileEModeSelection,
  resolveEModeViewState,
  resolveLtvAccentColor,
  shouldShowCurrentHealthFactorSkeleton,
} from './emodeUtils';

const status = {
  eModeId: 1,
  originalLtv: '80',
  categories: [
    {
      eModeId: 1,
      label: 'ETH correlated',
      ltv: '93',
      disabled: false,
      assets: [],
    },
    { eModeId: 2, label: 'Stablecoins', ltv: '95', disabled: true, assets: [] },
  ],
};

describe('buildEModeRows', () => {
  it('returns [] for null status', () => {
    expect(buildEModeRows(null, 'Off')).toEqual([]);
  });

  it('prepends an Off row and marks the current category selected', () => {
    const rows = buildEModeRows(status, 'Off');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      eModeId: 0,
      isOff: true,
      selected: false,
    });
    expect(rows[1]).toMatchObject({
      eModeId: 1,
      label: 'ETH correlated',
      ltv: '93',
      selected: true,
    });
    expect(rows[2]).toMatchObject({
      eModeId: 2,
      selected: false,
    });
  });

  it('marks Off selected when eModeId is 0', () => {
    const rows = buildEModeRows({ ...status, eModeId: 0 }, 'Off');
    expect(rows[0].selected).toBe(true);
    expect(rows.some((r) => !r.isOff && r.selected)).toBe(false);
  });

  it('seeds the Off row ltv from originalLtv', () => {
    expect(buildEModeRows(status, 'Off')[0]).toMatchObject({
      isOff: true,
      ltv: '80',
    });
  });

  it('uses the normalized backend label without deriving an asset sentence', () => {
    const rows = buildEModeRows(
      {
        eModeId: 0,
        originalLtv: '80',
        categories: [
          {
            ...status.categories[0],
            eModeId: 1,
            label: 'ETH_correlated',
          },
        ],
      },
      'Off',
    );

    expect(rows[1].displayLabel).toBe('ETH correlated');
  });
});

describe('buildEModeSelectDescription', () => {
  const formatMaxLtv = (ltv: string) => `Max LTV ${ltv}%`;
  const describe = (row: ReturnType<typeof buildEModeRows>[number]) =>
    buildEModeSelectDescription({
      row,
      currentEModeId: 1,
      currentText: 'Current',
      offText: 'Standard borrowing',
      formatMaxLtv,
      needsActionText: 'Needs action',
    });

  it('uses the current description for the active category', () => {
    expect(describe(buildEModeRows(status, 'Off')[1])).toBe('Current');
  });

  it('uses the standard borrowing description for an Off target', () => {
    expect(describe(buildEModeRows(status, 'Off')[0])).toBe(
      'Standard borrowing',
    );
  });

  it('builds a plain Max LTV description for a category target', () => {
    expect(describe(buildEModeRows(status, 'Off')[2])).toBe('Max LTV 95%');
  });

  it('appends Needs action for an explicitly blocked category target', () => {
    const row = {
      ...buildEModeRows(status, 'Off')[1],
      eModeId: 2,
      ltv: '93',
      canSwitch: false,
      selected: false,
    };

    expect(describe(row)).toBe('Max LTV 93% · Needs action');
  });
});

describe('reconcileEModeSelection', () => {
  it('has no effective selection before status loads', () => {
    expect(
      reconcileEModeSelection({
        statusCurrentId: null,
        userSelection: null,
        availableIds: [],
      }),
    ).toEqual({
      effectiveSelection: null,
      userSelection: null,
      resetTarget: false,
    });
  });

  it('derives the current category when there is no user override', () => {
    expect(
      reconcileEModeSelection({
        statusCurrentId: 1,
        userSelection: null,
        availableIds: [0, 1, 2],
      }),
    ).toEqual({
      effectiveSelection: 1,
      userSelection: null,
      resetTarget: false,
    });
  });

  it('retains an available target override across status refresh', () => {
    expect(
      reconcileEModeSelection({
        statusCurrentId: 1,
        userSelection: 2,
        availableIds: [0, 1, 2],
      }),
    ).toEqual({
      effectiveSelection: 2,
      userSelection: 2,
      resetTarget: false,
    });
  });

  it('clears the override when the target becomes current', () => {
    expect(
      reconcileEModeSelection({
        statusCurrentId: 2,
        userSelection: 2,
        availableIds: [0, 1, 2],
      }),
    ).toEqual({
      effectiveSelection: 2,
      userSelection: null,
      resetTarget: true,
    });
  });

  it('clears the override when the selected category disappears', () => {
    expect(
      reconcileEModeSelection({
        statusCurrentId: 1,
        userSelection: 9,
        availableIds: [0, 1, 2],
      }),
    ).toEqual({
      effectiveSelection: 1,
      userSelection: null,
      resetTarget: true,
    });
  });
});

describe('resolveEModeViewState', () => {
  const check = (canSwitch: boolean) =>
    ({ canSwitch }) as IBorrowEModeSwitchCheck;

  it('is loading without an effective current selection', () => {
    expect(
      resolveEModeViewState({
        effectiveSelection: null,
        currentEModeId: null,
        isChecking: false,
        requiresRevalidation: false,
        check: null,
      }),
    ).toBe('loading');
  });

  it('is current when the effective selection matches, including Off', () => {
    expect(
      resolveEModeViewState({
        effectiveSelection: 0,
        currentEModeId: 0,
        isChecking: false,
        requiresRevalidation: false,
        check: null,
      }),
    ).toBe('current');
  });

  it('is checking while a different target is being checked', () => {
    expect(
      resolveEModeViewState({
        effectiveSelection: 2,
        currentEModeId: 1,
        isChecking: true,
        requiresRevalidation: false,
        check: null,
      }),
    ).toBe('checking');
  });

  it('is error when a target check is neither loading nor available', () => {
    expect(
      resolveEModeViewState({
        effectiveSelection: 2,
        currentEModeId: 1,
        isChecking: false,
        requiresRevalidation: false,
        check: null,
      }),
    ).toBe('error');
  });

  it('is blocked when the authoritative check cannot switch', () => {
    expect(
      resolveEModeViewState({
        effectiveSelection: 2,
        currentEModeId: 1,
        isChecking: false,
        requiresRevalidation: false,
        check: check(false),
      }),
    ).toBe('blocked');
  });

  it('is switchable when the authoritative check can switch', () => {
    expect(
      resolveEModeViewState({
        effectiveSelection: 2,
        currentEModeId: 1,
        isChecking: false,
        requiresRevalidation: false,
        check: check(true),
      }),
    ).toBe('switchable');
  });

  it.each([true, false])(
    'is checking while a retained target requires revalidation even when the stale check canSwitch=%s',
    (canSwitch) => {
      const input: Parameters<typeof resolveEModeViewState>[0] = {
        effectiveSelection: 2,
        currentEModeId: 3,
        isChecking: false,
        check: check(canSwitch),
        requiresRevalidation: true,
      };

      expect(resolveEModeViewState(input)).toBe('checking');
    },
  );
});

const blocker = (symbol: string, addr: string): IBorrowEModeBlockerAsset =>
  ({
    reserveAddress: addr,
    token: { symbol, logoURI: `logo-${symbol}` },
    borrowed: { title: { text: `Borrowed ${symbol}` }, number: '1' },
    supplied: { title: { text: `Supplied ${symbol}` }, number: '1' },
  }) as unknown as IBorrowEModeBlockerAsset;

describe('buildNeedActionItems', () => {
  it('returns [] for null/undefined check', () => {
    expect(buildNeedActionItems(null)).toEqual([]);
    expect(buildNeedActionItems(undefined)).toEqual([]);
  });

  it('does not throw when blocker arrays are absent (server only sends reasons)', () => {
    const check = {
      canSwitch: false,
      reasons: ['x'],
    } as unknown as IBorrowEModeSwitchCheck;
    expect(buildNeedActionItems(check)).toEqual([]);
  });

  it('maps repay + additionalRepay to repay items and collateral to removeCollateral', () => {
    const check = {
      canSwitch: false,
      reasons: [],
      repayAssets: [blocker('USDC', '0xusdc')],
      additionalRepayAssets: [blocker('DAI', '0xdai')],
      disableCollateralAssets: [blocker('ETH', '0xeth')],
    } as unknown as IBorrowEModeSwitchCheck;
    const items = buildNeedActionItems(check);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      kind: 'repay',
      symbol: 'USDC',
      reserveAddress: '0xusdc',
      logoURI: 'logo-USDC',
    });
    expect(items[1]).toMatchObject({ kind: 'repay', symbol: 'DAI' });
    expect(items[2]).toMatchObject({
      kind: 'removeCollateral',
      symbol: 'ETH',
      reserveAddress: '0xeth',
    });
    expect(items[0].amount).toEqual({ text: 'Borrowed USDC' });
    expect(items[2].amount).toEqual({ text: 'Supplied ETH' });
  });
});

describe('buildEModeRows canSwitch passthrough', () => {
  it('carries canSwitch from category to row', () => {
    const rows = buildEModeRows(
      {
        eModeId: 0,
        originalLtv: '80',
        categories: [
          {
            eModeId: 7,
            label: 'Z',
            ltv: '70',
            disabled: false,
            canSwitch: false,
            assets: [],
          },
        ],
      },
      'Off',
    );
    expect(rows.find((r) => r.eModeId === 7)?.canSwitch).toBe(false);
  });

  it('carries liquidationThreshold from category to row', () => {
    const rows = buildEModeRows(
      {
        eModeId: 0,
        originalLtv: '80',
        categories: [
          {
            eModeId: 7,
            label: 'Z',
            ltv: '70',
            liquidationThreshold: '75',
            disabled: false,
            assets: [],
          },
        ],
      },
      'Off',
    );
    expect(rows.find((r) => r.eModeId === 7)?.liquidationThreshold).toBe('75');
  });

  it('carries assets from category to row', () => {
    const rows = buildEModeRows(
      {
        eModeId: 0,
        originalLtv: '80',
        categories: [
          {
            eModeId: 7,
            label: 'Z',
            ltv: '70',
            disabled: false,
            assets: [
              {
                reserveAddress: '0xeth',
                token: { symbol: 'ETH', logoURI: 'logo-ETH' },
                boostedLTV: true,
                borrowable: true,
              } as unknown as IBorrowEModeAsset,
            ],
          },
        ],
      },
      'Off',
    );
    expect(rows.find((r) => r.eModeId === 7)?.assets).toHaveLength(1);
  });
});

describe('buildNeedActionItems hfSafety + amountValue', () => {
  const a = (symbol: string, addr: string): IBorrowEModeBlockerAsset =>
    ({
      reserveAddress: addr,
      token: { symbol, logoURI: `logo-${symbol}` },
      borrowed: { title: { text: `B ${symbol}` }, number: '1.23' },
      supplied: { title: { text: `S ${symbol}` }, number: '4.56' },
    }) as unknown as IBorrowEModeBlockerAsset;

  it('tags additionalRepayAssets with hfSafety:true and repayAssets with false', () => {
    const check = {
      canSwitch: false,
      reasons: [],
      repayAssets: [a('DAI', '0xdai')],
      additionalRepayAssets: [a('USDC', '0xusdc')],
      disableCollateralAssets: [a('ETH', '0xeth')],
    } as unknown as IBorrowEModeSwitchCheck;
    const items = buildNeedActionItems(check);
    expect(items.find((i) => i.symbol === 'DAI')?.hfSafety).toBe(false);
    expect(items.find((i) => i.symbol === 'USDC')?.hfSafety).toBe(true);
  });

  it('carries the raw borrowed amount as amountValue on repay items', () => {
    const check = {
      canSwitch: false,
      reasons: [],
      additionalRepayAssets: [a('USDC', '0xusdc')],
    } as unknown as IBorrowEModeSwitchCheck;
    expect(buildNeedActionItems(check)[0].amountValue).toBe('1.23');
  });
});

describe('normalizeEModeLabel', () => {
  it('replaces underscore runs and slashes with spaces', () => {
    expect(normalizeEModeLabel('SyrupUSDC__USDC_GHO')).toBe(
      'SyrupUSDC USDC GHO',
    );
    expect(normalizeEModeLabel('rsETH/USDC')).toBe('rsETH USDC');
  });

  it('collapses whitespace and trims the result', () => {
    expect(normalizeEModeLabel('  ETH_  correlated  ')).toBe('ETH correlated');
  });

  it('falls back to the raw label when normalization is empty', () => {
    expect(normalizeEModeLabel('___/// ')).toBe('___/// ');
  });
});

describe('buildNeedActionItems amountFiat', () => {
  it('carries the server-formatted fiat for repay and disable items', () => {
    const items = buildNeedActionItems({
      canSwitch: false,
      reasons: [],
      repayAssets: [
        {
          reserveAddress: '0xa',
          token: { symbol: 'USDC' },
          borrowed: {
            title: { text: '120' },
            description: { text: '< $0.01' },
            number: '120',
          },
        },
      ],
      additionalRepayAssets: [],
      disableCollateralAssets: [
        {
          reserveAddress: '0xb',
          token: { symbol: 'DAI' },
          supplied: {
            title: { text: '0.0015' },
            description: { text: '$1.50' },
            number: '0.0015',
          },
        },
      ],
    } as unknown as IBorrowEModeSwitchCheck);
    expect(items[0].amountFiat?.text).toBe('< $0.01');
    expect(items[1].amountFiat?.text).toBe('$1.50');
  });
});

describe('resolveLtvAccentColor', () => {
  const t = (text: string) => ({ text });

  it('accents a rising Max LTV in success green', () => {
    expect(resolveLtvAccentColor(t('80%'), t('93%'))).toBe('$textSuccess');
    expect(resolveLtvAccentColor(t('81.55%'), t('90.00%'))).toBe(
      '$textSuccess',
    );
  });

  it('leaves falling or unchanged values to the server color', () => {
    expect(resolveLtvAccentColor(t('90%'), t('81.55%'))).toBeUndefined();
    expect(resolveLtvAccentColor(t('80%'), t('80%'))).toBeUndefined();
  });

  it('ignores non-numeric or missing values', () => {
    expect(resolveLtvAccentColor(t('—'), t('93%'))).toBeUndefined();
    expect(resolveLtvAccentColor(undefined, t('93%'))).toBeUndefined();
    expect(resolveLtvAccentColor(t('80%'), t('> 100'))).toBeUndefined();
  });
});

describe('shouldShowCurrentHealthFactorSkeleton', () => {
  it('keeps cached current Health Factor visible during a refresh', () => {
    expect(
      shouldShowCurrentHealthFactorSkeleton({
        isCurrent: true,
        currentHealthFactorLoading: true,
        currentHealthFactor: { text: '14.24' },
      }),
    ).toBe(false);
  });

  it('shows the skeleton only for an uncached current Health Factor load', () => {
    expect(
      shouldShowCurrentHealthFactorSkeleton({
        isCurrent: true,
        currentHealthFactorLoading: true,
        currentHealthFactor: undefined,
      }),
    ).toBe(true);
    expect(
      shouldShowCurrentHealthFactorSkeleton({
        isCurrent: false,
        currentHealthFactorLoading: true,
        currentHealthFactor: undefined,
      }),
    ).toBe(false);
  });
});

describe('E-Mode pending transaction guard', () => {
  it('guards only a committed unfocused-to-focused transition', () => {
    expect(
      isEModeFocusActivationPending({
        isFocused: true,
        previousIsFocused: false,
      }),
    ).toBe(true);
    expect(
      isEModeFocusActivationPending({
        isFocused: true,
        previousIsFocused: true,
      }),
    ).toBe(false);
    expect(
      isEModeFocusActivationPending({
        isFocused: true,
        previousIsFocused: undefined,
      }),
    ).toBe(false);
  });

  it('matches only the requested provider and Borrow action tags', () => {
    const matchesManagement = (tag: string) =>
      isEModeBorrowActionTag({
        tag,
        provider: 'Aave',
        actions: ['setEMode'],
      });

    expect(matchesManagement('borrow:aave:setEMode')).toBe(true);
    expect(matchesManagement('Borrow')).toBe(false);
    expect(matchesManagement('borrow:aave:repay')).toBe(false);
    expect(matchesManagement('borrow:kamino:setEMode')).toBe(false);
    expect(matchesManagement('borrow:aave:setEMode:claim')).toBe(false);
  });

  it('matches each Need Action transaction without matching unrelated Borrow activity', () => {
    const matchesNeedAction = (tag: string) =>
      isEModeBorrowActionTag({
        tag,
        provider: 'aave',
        actions: ['repay', 'setCollateral', 'setEMode'],
      });

    expect(matchesNeedAction('borrow:aave:repay')).toBe(true);
    expect(matchesNeedAction('borrow:aave:setCollateral')).toBe(true);
    expect(matchesNeedAction('borrow:aave:setEMode')).toBe(true);
    expect(matchesNeedAction('borrow:aave:borrow')).toBe(false);
    expect(matchesNeedAction('Borrow')).toBe(false);
  });

  it('blocks initial and focus revalidation windows as well as known pending transactions', () => {
    expect(
      isEModePendingGuardActive({
        pendingHistoryLoading: undefined,
        pendingCount: 0,
      }),
    ).toBe(true);
    expect(
      isEModePendingGuardActive({
        pendingHistoryLoading: true,
        pendingCount: 0,
      }),
    ).toBe(true);
    expect(
      isEModePendingGuardActive({
        pendingHistoryLoading: false,
        pendingCount: 1,
      }),
    ).toBe(true);
    expect(
      isEModePendingGuardActive({
        pendingHistoryLoading: false,
        pendingCount: 0,
        focusRevalidating: true,
      }),
    ).toBe(true);
    expect(
      isEModePendingGuardActive({
        pendingHistoryLoading: false,
        pendingCount: 0,
        focusRevalidating: false,
      }),
    ).toBe(false);
  });
});
