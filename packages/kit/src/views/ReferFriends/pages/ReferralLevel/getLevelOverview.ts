import BigNumber from 'bignumber.js';

import {
  sortCommissionRateItems,
  toAmount,
} from '@onekeyhq/kit/src/views/ReferFriends/utils';
import type {
  IInviteLevelCommissionRate,
  IInviteLevelDetail,
  IInviteLevelItem,
  IInviteLevelUpgradeCondition,
  IInviteUserConfig,
} from '@onekeyhq/shared/src/referralCode/type';

export interface ILevelTarget {
  subject: string;
  condition: IInviteLevelUpgradeCondition;
  current: BigNumber;
  target: BigNumber;
  remaining: BigNumber;
  progressPct: number;
  isReached: boolean;
}

export type ILevelRetentionStatus = 'kept' | 'notKept' | 'none';

export interface ILevelOverview {
  levelPolicy: NonNullable<IInviteUserConfig['levelPolicy']>;
  floorUntil?: string;
  currentLevel?: IInviteLevelItem;
  nextLevel?: IInviteLevelItem;
  retentionStatus: ILevelRetentionStatus;
  upgradeTargets: ILevelTarget[];
}

function toLevelTarget(condition: IInviteLevelUpgradeCondition): ILevelTarget {
  const current = toAmount(condition.currentFiatValue);
  const target = toAmount(condition.thresholdFiatValue);
  const isReached = current.gte(target);
  const progressPct = target.isZero()
    ? 100
    : Math.min(100, current.div(target).times(100).toNumber());
  return {
    subject: condition.subject,
    condition,
    current,
    target,
    remaining: isReached ? new BigNumber(0) : target.minus(current),
    progressPct,
    isReached,
  };
}

// Levels arrive in ascending order: the conditions to keep a level are the
// upgrade conditions of the level below it.
export function getLevelOverview(
  data: IInviteLevelDetail | undefined,
  now = Date.now(),
): ILevelOverview {
  const configuredPolicy =
    data?.levelPolicy ?? (data?.levelLock?.isLocked ? 'fixed' : 'normal');
  // Expiration changes the display policy, never the level returned by the server.
  const levelPolicy =
    configuredPolicy === 'floor' &&
    data?.floorUntil &&
    Date.parse(data.floorUntil) <= now
      ? 'normal'
      : configuredPolicy;
  if (!data) {
    return { levelPolicy, retentionStatus: 'none', upgradeTargets: [] };
  }
  const byLevel = data.levels.findIndex(
    (level) => level.level === data.currentLevel,
  );
  const currentIndex =
    byLevel >= 0 ? byLevel : data.levels.findIndex((level) => level.isCurrent);
  if (currentIndex < 0) {
    return { levelPolicy, retentionStatus: 'none', upgradeTargets: [] };
  }

  const currentLevel = data.levels[currentIndex];
  const nextLevel = data.levels[currentIndex + 1];
  const retentionConditions =
    currentIndex > 0 ? data.levels[currentIndex - 1].upgradeConditions : [];

  let retentionStatus: ILevelRetentionStatus = 'none';
  if (levelPolicy === 'normal' && retentionConditions.length > 0) {
    retentionStatus = retentionConditions.some(
      (condition) => toLevelTarget(condition).isReached,
    )
      ? 'kept'
      : 'notKept';
  }

  return {
    levelPolicy,
    floorUntil:
      levelPolicy === 'floor' ? (data.floorUntil ?? undefined) : undefined,
    currentLevel,
    nextLevel,
    retentionStatus,
    upgradeTargets:
      nextLevel && levelPolicy !== 'fixed'
        ? sortCommissionRateItems(
            currentLevel.upgradeConditions.map(toLevelTarget),
          )
        : [],
  };
}

export function getLevelCommissionRateItems(
  rates: IInviteLevelItem['commissionRates'] | undefined,
): { subject: string; rate: IInviteLevelCommissionRate }[] {
  if (!rates) {
    return [];
  }
  const items = Array.isArray(rates)
    ? rates.map((rate, index) => ({
        subject: rate.labelKey ?? `${index}`,
        rate,
      }))
    : Object.entries(rates).map(([subject, rate]) => ({ subject, rate }));
  // A product the backend turns off pays nothing, so its rate is not listed.
  return sortCommissionRateItems(
    items.filter(({ rate }) => rate.enabled !== false),
  );
}
