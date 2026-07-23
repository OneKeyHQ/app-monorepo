import type {
  IBorrowEModeBlockerAsset,
  IBorrowEModeStatus,
  IBorrowEModeSwitchCheck,
} from '@onekeyhq/shared/types/staking';

import {
  buildEModeRows,
  buildNeedActionItems,
  isEModePendingGuardActive,
} from './emodeUtils';

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
