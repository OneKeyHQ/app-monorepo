import type {
  IInviteLevelDetail,
  IInviteLevelItem,
  IInviteLevelUpgradeCondition,
} from '@onekeyhq/shared/src/referralCode/type';

import { getLevelOverview } from './getLevelOverview';

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
});
