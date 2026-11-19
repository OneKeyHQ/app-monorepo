import { buildBorrowTag } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import type {
  IBorrowEModeBlockerAsset,
  IBorrowEModeStatus,
  IBorrowEModeSwitchCheck,
} from '@onekeyhq/shared/types/staking';

import {
  E_MODE_PENDING_GUARD_ACTIONS,
  buildEModeRowSubtitle,
  buildEModeRows,
  buildNeedActionItems,
  isEModeBorrowActionTag,
  isEModePendingGuardActive,
} from './emodeUtils';

import type { IEModeRow } from './emodeUtils';

describe('isEModeBorrowActionTag', () => {
  it('matches every transaction that can invalidate an E-Mode switch check', () => {
    const provider = 'aave';

    expect(E_MODE_PENDING_GUARD_ACTIONS).toEqual([
      'repay',
      'setCollateral',
      'setEMode',
    ]);
    E_MODE_PENDING_GUARD_ACTIONS.forEach((action) => {
      expect(
        isEModeBorrowActionTag({
          tag: buildBorrowTag({ provider, action }),
          provider,
          actions: E_MODE_PENDING_GUARD_ACTIONS,
        }),
      ).toBe(true);
    });

    expect(
      isEModeBorrowActionTag({
        tag: buildBorrowTag({ provider, action: 'borrow' }),
        provider,
        actions: E_MODE_PENDING_GUARD_ACTIONS,
      }),
    ).toBe(false);
  });
});

describe('isEModePendingGuardActive', () => {
  it('fails closed when pending history finished loading but is unverified', () => {
    expect(
      isEModePendingGuardActive({
        pendingHistoryLoading: false,
        isPendingHistoryVerified: false,
        pendingCount: 0,
      }),
    ).toBe(true);
  });

  it('unlocks only after pending history is verified empty', () => {
    expect(
      isEModePendingGuardActive({
        pendingHistoryLoading: false,
        isPendingHistoryVerified: true,
        pendingCount: 0,
      }),
    ).toBe(false);
  });
});

describe('buildEModeRows', () => {
  it('preserves backend-disabled categories while keeping Off available', () => {
    const status: IBorrowEModeStatus = {
      eModeId: 1,
      originalLtv: '80',
      categories: [
        {
          eModeId: 1,
          label: 'Stablecoins',
          ltv: '93',
          disabled: true,
          assets: [],
        },
      ],
    };

    const rows = buildEModeRows(status, 'Off');

    expect(rows[0].disabled).toBe(false);
    expect(rows[1].disabled).toBe(true);
  });
});

describe('buildNeedActionItems', () => {
  it('marks only additional health-factor repayments as partial', () => {
    const blockerAsset: IBorrowEModeBlockerAsset = {
      reserveAddress: '0xreserve',
      token: {
        decimals: 6,
        name: 'USD Coin',
        symbol: 'USDC',
        address: '0xusdc',
        isNative: false,
      },
      borrowed: {
        title: { text: '1' },
        number: '1',
      },
    };
    const check: IBorrowEModeSwitchCheck = {
      canSwitch: false,
      reasons: [],
      repayAssets: [blockerAsset],
      additionalRepayAssets: [
        { ...blockerAsset, reserveAddress: '0xadditional' },
      ],
      disableCollateralAssets: [],
      collateral: {},
      debt: {},
      maxLtv: {},
      healthFactor: {},
    };

    const items = buildNeedActionItems(check);

    expect(items[0].hfSafety).toBe(false);
    expect(items[1].hfSafety).toBe(true);
  });
});

describe('buildEModeRowSubtitle', () => {
  const subtitleOf = (row: Partial<IEModeRow>) =>
    buildEModeRowSubtitle({
      row: {
        eModeId: 1,
        label: 'stablecoins',
        displayLabel: 'Stablecoins',
        disabled: false,
        selected: false,
        isOff: false,
        ...row,
      },
      offText: 'Standard borrowing',
      formatMaxLtv: (ltv) => `Max LTV ${ltv}%`,
      needsActionText: 'Needs action',
    });

  it('leads with Max LTV so the picker rows stay comparable', () => {
    expect(subtitleOf({ ltv: '93' })).toBe('Max LTV 93%');
  });

  // The Off row's ltv is the market LTV before any e-mode boost, which is the
  // number the boosted categories are being compared against.
  it('keeps Max LTV on the Off row when the market reports one', () => {
    expect(subtitleOf({ isOff: true, ltv: '80' })).toBe('Max LTV 80%');
  });

  it('falls back to the off copy only when the Off row has no LTV', () => {
    expect(subtitleOf({ isOff: true })).toBe('Standard borrowing');
  });

  it('does not describe a boosted category as standard borrowing', () => {
    expect(subtitleOf({})).toBe('');
  });

  it('appends the blocker only when the backend says the switch is refused', () => {
    expect(subtitleOf({ ltv: '90', canSwitch: false })).toBe(
      'Max LTV 90% · Needs action',
    );
    expect(subtitleOf({ ltv: '90', canSwitch: true })).toBe('Max LTV 90%');
    expect(subtitleOf({ ltv: '90' })).toBe('Max LTV 90%');
  });
});
