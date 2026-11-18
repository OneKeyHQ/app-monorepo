/*
yarn jest packages/kit/src/views/RewardCenter/pages/SubsidyCenter/subsidyRecordUtils.test.ts
*/
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
      title: 'Gas 赞助交易',
      networkId: 'evm--8453',
      createdAt: '2026-11-10T02:24:00.000Z',
      amountUsd: '0.08',
    });
  });

  it.each([
    ['send', '转账'],
    ['swap', '兑换'],
    ['perps', 'Gas 赞助交易'],
    ['a-scenario-added-later', 'Gas 赞助交易'],
  ])('titles the %s scenario as %s', (scenario, title) => {
    expect(buildSubsidyRecordRow(gaRecord({ scenario })).title).toBe(title);
  });

  it('reports a pending settlement instead of an amount', () => {
    const row = buildSubsidyRecordRow(
      gaRecord({ sponsorCostUsd: null, amountStatus: 'pending' }),
    );
    expect(row.amountUsd).toBeUndefined();
    expect(row.statusLabel).toBe('结算中');
  });

  it.each(['unavailable', 'evidenced', 'a-status-added-later'])(
    'leaves a missing amount blank when the status is %s, never 0',
    (amountStatus) => {
      const row = buildSubsidyRecordRow(
        gaRecord({ sponsorCostUsd: null, amountStatus }),
      );
      expect(row.amountUsd).toBeUndefined();
      expect(row.statusLabel).toBe('—');
    },
  );
});

describe('buildSubsidyRecordRow: TRON energy', () => {
  it.each([
    ['free_claim', '免费领取能量'],
    ['code_redeem', '兑换码兑换'],
    ['other', '其他补贴'],
  ])('titles the %s operation as %s', (operation, title) => {
    expect(buildSubsidyRecordRow(tronRecord({ operation })).title).toBe(title);
  });

  it.each([
    ['dispatching', '处理中'],
    ['supplier_accepted', '已受理'],
    ['supplier_rejected', '未受理'],
    ['unknown', '结果待确认'],
    ['a-state-added-later', '其他'],
  ])('labels the %s state as %s and never shows an amount', (state, label) => {
    const row = buildSubsidyRecordRow(tronRecord({ state }));
    expect(row.statusLabel).toBe(label);
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
      title: '其他补贴',
      statusLabel: '—',
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
    expect(formatSubsidyCount(view.gaSettledCount, '笔')).toBe('0 笔');
  });

  it('leaves every value undefined when the amount or a source is missing', () => {
    expect(
      buildSubsidySummaryView({
        ...summary,
        ga: { ...summary.ga, sponsorCostUsd: null } as ISubsidySummary['ga'],
        tron: undefined,
      }),
    ).toEqual({
      sponsorCostUsd: undefined,
      gaSettledCount: 18,
      tronAcceptedCount: undefined,
    });
    expect(buildSubsidySummaryView(undefined)).toEqual({
      sponsorCostUsd: undefined,
      gaSettledCount: undefined,
      tronAcceptedCount: undefined,
    });
    expect(formatSubsidyCount(undefined, '次')).toBe('—');
  });
});
