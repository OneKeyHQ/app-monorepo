import type {
  IInviteLevelCommissionRate,
  IInviteLevelDetail,
  IInviteLevelItem,
  IInviteLevelUpgradeCondition,
} from '@onekeyhq/shared/src/referralCode/type';

import {
  getLevelCommissionRateItems,
  getLevelOverview,
} from './getLevelOverview';

function condition(
  subject: string,
  current: string,
  threshold: string,
): IInviteLevelUpgradeCondition {
  return {
    subject,
    current,
    currentFiatValue: current,
    threshold,
    thresholdFiatValue: threshold,
    progress: '0',
  };
}

function level(
  value: number,
  label: string,
  upgradeConditions: IInviteLevelUpgradeCondition[],
): IInviteLevelItem {
  return {
    level: value,
    icon: '',
    emoji: '',
    labelKey: '',
    label,
    isCurrent: false,
    upgradeConditions,
    commissionRates: {},
  };
}

// Silver -> Gold needs 1K hardware or 2M perps; Gold -> Diamond needs 8K or 16M.
const LEVELS = [
  level(1, 'Silver', [
    condition('HardwareSales', '1128', '1000'),
    condition('Perp', '175577.91', '2000000'),
  ]),
  level(2, 'Gold', [
    condition('HardwareSales', '1128', '8000'),
    condition('Perp', '175577.91', '16000000'),
  ]),
  level(3, 'Diamond', []),
];

function detail(currentLevel: number, levels = LEVELS): IInviteLevelDetail {
  return { currentLevel, levelProgress: {}, levels };
}

describe('getLevelOverview', () => {
  it('reports retention and the gap to the next level', () => {
    const overview = getLevelOverview(detail(2));

    expect(overview.currentLevel?.label).toBe('Gold');
    expect(overview.nextLevel?.label).toBe('Diamond');
    expect(overview.retentionStatus).toBe('kept');
    expect(
      overview.upgradeTargets.map((target) => [
        target.subject,
        target.remaining.toFixed(2),
        Math.round(target.progressPct * 10) / 10,
      ]),
    ).toEqual([
      ['HardwareSales', '6872.00', 14.1],
      ['Perp', '15824422.09', 1.1],
    ]);
  });

  it('flags retention when no condition is met yet', () => {
    const levels = [
      level(1, 'Silver', [condition('HardwareSales', '500', '1000')]),
      ...LEVELS.slice(1),
    ];

    expect(getLevelOverview(detail(2, levels)).retentionStatus).toBe('notKept');
  });

  it('has no retention for the lowest level and no targets at the top', () => {
    expect(getLevelOverview(detail(1)).retentionStatus).toBe('none');

    const top = getLevelOverview(detail(3));
    expect(top.nextLevel).toBeUndefined();
    expect(top.upgradeTargets).toEqual([]);
  });

  it('marks a reached target with nothing left to go', () => {
    const [target] = getLevelOverview(detail(1)).upgradeTargets;

    expect(target.isReached).toBe(true);
    expect(target.remaining.isZero()).toBe(true);
    expect(target.progressPct).toBe(100);
  });

  it('keeps upgrades available for floor users without a retention warning', () => {
    const overview = getLevelOverview(
      {
        ...detail(2),
        levelPolicy: 'floor',
        floorUntil: '2026-10-30T16:00:00.000Z',
      },
      Date.parse('2026-10-29T00:00:00.000Z'),
    );

    expect(overview.levelPolicy).toBe('floor');
    expect(overview.floorUntil).toBe('2026-10-30T16:00:00.000Z');
    expect(overview.retentionStatus).toBe('none');
    expect(overview.nextLevel?.label).toBe('Diamond');
    expect(overview.upgradeTargets).toHaveLength(2);
  });

  it('does not offer automatic upgrades or retention for a fixed level', () => {
    const overview = getLevelOverview({ ...detail(1), levelPolicy: 'fixed' });

    expect(overview.levelPolicy).toBe('fixed');
    expect(overview.currentLevel?.label).toBe('Silver');
    expect(overview.nextLevel?.label).toBe('Gold');
    expect(overview.retentionStatus).toBe('none');
    expect(overview.upgradeTargets).toEqual([]);
  });

  it('ends expired floor protection without changing the server-provided level', () => {
    const data: IInviteLevelDetail = {
      ...detail(2),
      levelPolicy: 'floor',
      floorUntil: '2026-10-30T16:00:00.000Z',
    };
    const overview = getLevelOverview(
      data,
      Date.parse('2026-10-30T16:00:00.000Z'),
    );

    expect(overview.levelPolicy).toBe('normal');
    expect(overview.floorUntil).toBeUndefined();
    expect(overview.currentLevel).toBe(data.levels[1]);
    expect(overview.retentionStatus).toBe('kept');
    expect(overview.upgradeTargets).toHaveLength(2);
    expect(data.levelPolicy).toBe('floor');
  });

  it('recognizes a legacy level lock when the policy field is absent', () => {
    const overview = getLevelOverview({
      ...detail(1),
      levelLock: { isLocked: true },
    });

    expect(overview.levelPolicy).toBe('fixed');
    expect(overview.upgradeTargets).toEqual([]);
  });

  it('uses the explicit policy instead of inferring it from the level lock', () => {
    expect(
      getLevelOverview({
        ...detail(1),
        levelPolicy: 'normal',
        levelLock: { isLocked: true },
      }).levelPolicy,
    ).toBe('normal');
  });

  it('returns to normal progression when protection is removed', () => {
    const protectedDetail: IInviteLevelDetail = {
      ...detail(2),
      levelPolicy: 'floor',
    };
    expect(getLevelOverview(protectedDetail).retentionStatus).toBe('none');
    expect(
      getLevelOverview({
        ...protectedDetail,
        levelPolicy: 'normal',
      }).retentionStatus,
    ).toBe('kept');
    expect(
      getLevelOverview({
        ...protectedDetail,
        levelPolicy: 'normal',
        floorUntil: '2026-10-30T16:00:00.000Z',
      }).floorUntil,
    ).toBeUndefined();
  });

  it.each(['normal', 'floor', 'fixed'] as const)(
    'keeps standard rules unchanged when a plan is added or removed with %s',
    (levelPolicy) => {
      const data: IInviteLevelDetail = { ...detail(2), levelPolicy };
      const before = JSON.stringify(data);
      const normalRates = getLevelOverview(data);
      const withPlan = getLevelOverview({
        ...data,
        partnerPlan: { planId: 'test-plan' },
        configs: { HardwareSales: { status: 'ok', rebate: 50, discount: 0 } },
      });

      expect(withPlan).toEqual(normalRates);
      expect(withPlan.currentLevel).toBe(data.levels[1]);
      expect(JSON.stringify(data)).toBe(before);
      expect(getLevelOverview({ ...data, partnerPlan: null })).toEqual(
        normalRates,
      );
    },
  );
});

describe('getLevelCommissionRateItems', () => {
  const rate = (enabled: boolean): IInviteLevelCommissionRate => ({
    rebate: 10,
    discount: 5,
    enabled,
    hasThreshold: false,
  });

  it('leaves out products the backend turns off', () => {
    expect(
      getLevelCommissionRateItems({
        Perp: rate(true),
        Swap: rate(false),
      }).map((item) => item.subject),
    ).toEqual(['Perp']);
  });
});
