/*
yarn jest packages/kit/src/views/RewardCenter/pages/SubsidyCenter/subsidyRecordUtils.test.ts
*/
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ESubsidyRecordKind,
  ESubsidyTronState,
} from '@onekeyhq/shared/types/subsidy';
import type {
  ISubsidyGaRecord,
  ISubsidyRecord,
  ISubsidySummary,
  ISubsidyTronRecord,
} from '@onekeyhq/shared/types/subsidy';

import {
  buildSubsidyRecordRow,
  buildSubsidySummaryView,
  formatSubsidyCount,
  getSubsidyPageCount,
  getSubsidyPageSize,
  isSubsidyPagePastEnd,
} from './subsidyRecordUtils';

function gaRecord(ga: Partial<ISubsidyGaRecord['ga']> = {}): ISubsidyGaRecord {
  return {
    id: 'ga_sponsorship:intent-1',
    kind: ESubsidyRecordKind.GaSponsorship,
    operation: 'sponsored_transaction',
    networkId: 'evm--8453',
    address: '0xabc',
    createdAt: '2026-11-10T02:24:00.000Z',
    resolvedAt: '2026-11-10T02:25:00.000Z',
    state: 'settled',
    transaction: { hash: '0xhash', blockNumber: 1 },
    ga: {
      settlementStage: 'final',
      amountStatus: 'evidenced',
      userTxFee: { value: '1000', unit: 'wei' },
      fundingTxFee: null,
      sponsorCostUsd: { value: '0.08', basis: 'reconcile_time_valuation' },
      netSubsidy: null,
      ...ga,
    },
  };
}

function tronRecord(
  overrides: Partial<ISubsidyTronRecord> = {},
): ISubsidyTronRecord {
  return {
    id: 'tron_energy:attempt-1',
    kind: ESubsidyRecordKind.TronEnergy,
    operation: 'free_claim',
    networkId: 'tron--0x2b6653dc',
    address: 'TAddress',
    createdAt: '2026-11-09T01:41:00.000Z',
    resolvedAt: null,
    state: 'supplier_accepted',
    transaction: null,
    ...overrides,
  };
}

describe('buildSubsidyRecordRow: Gas Account sponsorship', () => {
  it('shows the sponsor cost and the generic title when no scenario is returned', () => {
    expect(buildSubsidyRecordRow(gaRecord())).toEqual({
      id: 'ga_sponsorship:intent-1',
      icon: 'GasOutline',
      titleId: ETranslations.subsidy_network_fee__title,
      networkId: 'evm--8453',
      createdAt: '2026-11-10T02:24:00.000Z',
      amountUsd: '0.08',
    });
  });

  it.each([
    ['send', ETranslations.subsidy_transfer_fee__title],
    ['swap', ETranslations.subsidy_swap_fee__title],
    ['perps', ETranslations.subsidy_network_fee__title],
    ['a-scenario-added-later', ETranslations.subsidy_network_fee__title],
  ])('titles the %s scenario as %s', (scenario, title) => {
    expect(buildSubsidyRecordRow(gaRecord({ scenario })).titleId).toBe(title);
  });

  it('reports a pending settlement instead of an amount', () => {
    const row = buildSubsidyRecordRow(
      gaRecord({ sponsorCostUsd: null, amountStatus: 'pending' }),
    );
    expect(row.amountUsd).toBeUndefined();
    expect(row.statusId).toBe(ETranslations.subsidy_settling__title);
  });

  it.each(['unavailable', 'evidenced', 'a-status-added-later'])(
    'leaves a missing amount blank when the status is %s, never 0',
    (amountStatus) => {
      const row = buildSubsidyRecordRow(
        gaRecord({ sponsorCostUsd: null, amountStatus }),
      );
      expect(row.amountUsd).toBeUndefined();
      expect(row.statusId).toBeUndefined();
    },
  );
});

describe('buildSubsidyRecordRow: TRON energy', () => {
  it.each([
    ['free_claim', ETranslations.subsidy_free_claim__title],
    ['code_redeem', ETranslations.subsidy_code_energy__title],
    ['other', ETranslations.subsidy_other__title],
  ])('titles the %s operation as %s', (operation, title) => {
    expect(buildSubsidyRecordRow(tronRecord({ operation })).titleId).toBe(
      title,
    );
  });

  it.each([
    ['dispatching', ETranslations.global_processing],
    ['supplier_accepted', ETranslations.subsidy_claimed__title],
    ['supplier_rejected', ETranslations.subsidy_not_accepted__title],
    ['unknown', ETranslations.subsidy_unconfirmed__title],
    ['a-state-added-later', ETranslations.global_others],
  ])('labels the %s state as %s and never shows an amount', (state, label) => {
    const row = buildSubsidyRecordRow(tronRecord({ state }));
    expect(row.statusId).toBe(label);
    expect(row.amountUsd).toBeUndefined();
    expect(row.icon).toBe('FlashSolid');
  });
});

describe('buildSubsidyRecordRow: unknown kind', () => {
  it('renders a record of a kind added later instead of throwing', () => {
    const record = {
      ...tronRecord(),
      id: 'energy_pack:1',
      kind: 'energy_pack',
    } as unknown as ISubsidyRecord;

    expect(buildSubsidyRecordRow(record)).toMatchObject({
      id: 'energy_pack:1',
      titleId: ETranslations.subsidy_other__title,
    });
  });
});

describe('buildSubsidySummaryView', () => {
  const summary: ISubsidySummary = {
    contractVersion: 1,
    subjectScope: 'canonical',
    asOf: '2026-11-18T00:00:00.000Z',
    ga: {
      operations: 20,
      sponsoredCount: 18,
      evidencedOperations: 12,
      feeTotals: [],
      sponsorCostUsd: {
        value: '12.86',
        basis: 'reconcile_time_valuation',
        coveredCount: 12,
      },
    },
    tron: {
      attempts: 5,
      byState: {
        [ESubsidyTronState.Dispatching]: 0,
        [ESubsidyTronState.SupplierAccepted]: 3,
        [ESubsidyTronState.SupplierRejected]: 1,
        [ESubsidyTronState.Unknown]: 1,
      },
    },
  };

  it('reads the sponsor cost, settled count and accepted TRON attempts', () => {
    expect(buildSubsidySummaryView(summary)).toEqual({
      sponsorCostUsd: '12.86',
      gaSettledCount: 18,
      tronAcceptedCount: 3,
    });
  });

  it('keeps a zero count as 0', () => {
    const view = buildSubsidySummaryView({
      ...summary,
      ga: { ...summary.ga, sponsoredCount: 0 } as ISubsidySummary['ga'],
    });
    expect(view.gaSettledCount).toBe(0);
    expect(formatSubsidyCount(view.gaSettledCount)).toBe('0');
  });

  it('displays a null sponsor cost as zero even when there are settled records', () => {
    expect(
      buildSubsidySummaryView({
        ...summary,
        ga: { ...summary.ga, sponsorCostUsd: null } as ISubsidySummary['ga'],
        tron: undefined,
      }),
    ).toEqual({
      sponsorCostUsd: '0',
      gaSettledCount: 18,
      tronAcceptedCount: undefined,
    });
  });

  it('keeps missing responses and sources unknown', () => {
    expect(buildSubsidySummaryView({ ...summary, ga: undefined })).toEqual({
      sponsorCostUsd: undefined,
      gaSettledCount: undefined,
      tronAcceptedCount: 3,
    });
    expect(buildSubsidySummaryView(undefined)).toEqual({
      sponsorCostUsd: undefined,
      gaSettledCount: undefined,
      tronAcceptedCount: undefined,
    });
    expect(formatSubsidyCount(undefined)).toBe('--');
  });
});

describe('getSubsidyPageSize', () => {
  it('fits whole rows into the list area', () => {
    expect(getSubsidyPageSize(340, 52)).toBe(6);
    expect(getSubsidyPageSize(700, 64)).toBe(10);
  });

  it('stays within what the server accepts (1-50)', () => {
    expect(getSubsidyPageSize(10, 52)).toBe(1);
    expect(getSubsidyPageSize(5000, 52)).toBe(50);
  });
});

describe('getSubsidyPageCount', () => {
  it('rounds the last partial page up', () => {
    expect(getSubsidyPageCount(15, 7)).toBe(3);
    expect(getSubsidyPageCount(14, 7)).toBe(2);
  });

  it('is one page for an empty list', () => {
    expect(getSubsidyPageCount(0, 7)).toBe(1);
  });

  it('is unknown when the total or the page size is unknown', () => {
    expect(getSubsidyPageCount(null, 7)).toBeUndefined();
    expect(getSubsidyPageCount(undefined, 7)).toBeUndefined();
    expect(getSubsidyPageCount(15, undefined)).toBeUndefined();
  });
});

describe('isSubsidyPagePastEnd', () => {
  const emptyPage = {
    page: 3,
    isSettled: true,
    itemCount: 0,
    isPartial: false,
    hasMore: false,
  };

  it('is past the end for a settled, complete, empty later page', () => {
    expect(isSubsidyPagePastEnd(emptyPage)).toBe(true);
  });

  it('never applies to the first page, which is simply empty', () => {
    expect(isSubsidyPagePastEnd({ ...emptyPage, page: 1 })).toBe(false);
  });

  it('waits for the page to settle before judging a cached or kept copy', () => {
    expect(isSubsidyPagePastEnd({ ...emptyPage, isSettled: false })).toBe(
      false,
    );
    expect(isSubsidyPagePastEnd({ ...emptyPage, itemCount: undefined })).toBe(
      false,
    );
  });

  it('keeps an empty page whose source failed, so it can be retried in place', () => {
    expect(isSubsidyPagePastEnd({ ...emptyPage, isPartial: true })).toBe(false);
  });

  it('keeps an empty page that still has a successor', () => {
    expect(isSubsidyPagePastEnd({ ...emptyPage, hasMore: true })).toBe(false);
  });

  it('is not past the end while the page has records', () => {
    expect(isSubsidyPagePastEnd({ ...emptyPage, itemCount: 4 })).toBe(false);
  });
});
