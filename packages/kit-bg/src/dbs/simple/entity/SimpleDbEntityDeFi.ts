import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IDeFiDBStruct {
  enabledNetworksMap?: Record<string, boolean>; // <networkId, enabled>
  manualForceRefreshQuota?: {
    dayKey: string;
    count: number;
    lastForcedAt: number;
  };
  overview?: Record<
    string,
    Record<
      string,
      {
        totalValue: number;
        totalDebt: number;
        totalReward: number;
        netWorth: number;
        currency: string;
      }
    >
  >; // <accountAddress/xpub, <networkId, overview>>
}

export class SimpleDbEntityDeFi extends SimpleDbEntityBase<IDeFiDBStruct> {
  entityName = 'deFi';

  override enableCache = false;

  @backgroundMethod()
  async updateEnabledNetworksMap({
    merge,
    enabledNetworksMap = {},
  }: {
    merge?: boolean;
    enabledNetworksMap?: Record<string, boolean>;
  }) {
    await this.setRawData((rawData) => {
      const originalEnabledNetworksMap = rawData?.enabledNetworksMap ?? {};
      const finalEnabledNetworksMap = merge
        ? {
            ...originalEnabledNetworksMap,
            ...enabledNetworksMap,
          }
        : enabledNetworksMap;
      return { ...rawData, enabledNetworksMap: finalEnabledNetworksMap };
    });
  }

  @backgroundMethod()
  async getEnabledNetworksMap(): Promise<Record<string, boolean>> {
    const rawData = await this.getRawData();
    return rawData?.enabledNetworksMap ?? {};
  }

  @backgroundMethod()
  async consumeManualForceRefreshQuota({
    dayKey,
    now,
    dailyLimit,
    minIntervalMs,
  }: {
    dayKey: string;
    now: number;
    dailyLimit: number;
    minIntervalMs: number;
  }): Promise<{
    allowed: boolean;
    reason?: 'daily-limit' | 'interval';
    count: number;
    lastForcedAt: number;
    dailyLimit: number;
    minIntervalMs: number;
  }> {
    let result: {
      allowed: boolean;
      reason?: 'daily-limit' | 'interval';
      count: number;
      lastForcedAt: number;
      dailyLimit: number;
      minIntervalMs: number;
    } = {
      allowed: false,
      count: 0,
      lastForcedAt: 0,
      dailyLimit,
      minIntervalMs,
    };

    await this.setRawData((rawData) => {
      const current = rawData?.manualForceRefreshQuota;
      const normalized =
        current?.dayKey === dayKey
          ? current
          : {
              dayKey,
              count: 0,
              lastForcedAt: 0,
            };

      if (
        normalized.lastForcedAt > 0 &&
        now - normalized.lastForcedAt < minIntervalMs
      ) {
        result = {
          allowed: false,
          reason: 'interval',
          count: normalized.count,
          lastForcedAt: normalized.lastForcedAt,
          dailyLimit,
          minIntervalMs,
        };
        return {
          ...rawData,
          manualForceRefreshQuota: normalized,
        };
      }

      if (normalized.count >= dailyLimit) {
        result = {
          allowed: false,
          reason: 'daily-limit',
          count: normalized.count,
          lastForcedAt: normalized.lastForcedAt,
          dailyLimit,
          minIntervalMs,
        };
        return {
          ...rawData,
          manualForceRefreshQuota: normalized,
        };
      }

      const nextQuota = {
        dayKey,
        count: normalized.count + 1,
        lastForcedAt: now,
      };
      result = {
        allowed: true,
        count: nextQuota.count,
        lastForcedAt: nextQuota.lastForcedAt,
        dailyLimit,
        minIntervalMs,
      };
      return {
        ...rawData,
        manualForceRefreshQuota: nextQuota,
      };
    });

    return result;
  }

  @backgroundMethod()
  async updateAccountDeFiOverview({
    accountAddress,
    xpub,
    overview,
    merge,
  }: {
    accountAddress?: string;
    xpub?: string;
    overview: Record<
      string,
      {
        totalValue: number;
        totalDebt: number;
        totalReward: number;
        netWorth: number;
        currency: string;
      }
    >;
    merge?: boolean;
  }) {
    const key = accountUtils.buildAccountLocalAssetsKey({
      accountAddress,
      xpub,
    });

    await this.setRawData((rawData) => {
      const data = rawData?.overview ?? {};
      const originalOverview = data[key] ?? {};
      if (originalOverview && merge) {
        return {
          ...rawData,
          overview: { ...data, [key]: { ...originalOverview, ...overview } },
        };
      }
      return { ...rawData, overview: { ...data, [key]: overview } };
    });
  }

  @backgroundMethod()
  async getAccountsDeFiOverview({
    accounts,
    deFiRawData,
  }: {
    accounts: {
      accountAddress?: string;
      xpub?: string;
    }[];
    deFiRawData?: IDeFiDBStruct;
  }) {
    const rawData = deFiRawData ?? (await this.getRawData());
    return accounts.map(({ accountAddress, xpub }) => {
      if (!accountAddress && !xpub) {
        return undefined;
      }

      const key = accountUtils.buildAccountLocalAssetsKey({
        accountAddress,
        xpub,
      });

      if (!rawData?.overview?.[key]) {
        return undefined;
      }

      return {
        accountAddress,
        xpub,
        overview: rawData?.overview?.[key],
      };
    });
  }

  // Drop cached DeFi overviews belonging to deleted accounts. `overview` keys are
  // bare addresses/xpubs (no networkId prefix). `validOwners` is the set of
  // lowercased addresses/xpubs of all surviving accounts. Pure-cache cleanup.
  // See ServiceAppCleanup.cleanupOrphanedAssetCaches.
  @backgroundMethod()
  async removeOrphanData({ validOwners }: { validOwners: string[] }) {
    const existing = await this.getRawData();
    if (!existing) {
      return;
    }
    const validOwnerSet = new Set(validOwners.map((o) => o.toLowerCase()));
    await this.setRawData((rawData) => {
      // Trust the in-mutex fresh value, not the pre-mutex `existing` snapshot, so
      // a concurrent clearRawData is never undone by an `existing` fallback.
      const base = rawData;
      const overview = base?.overview ?? {};
      const nextOverview: NonNullable<IDeFiDBStruct['overview']> = {};
      for (const [key, value] of Object.entries(overview)) {
        if (
          accountUtils.isLocalAssetsKeyOwnedBy({
            key,
            validOwners: validOwnerSet,
          })
        ) {
          nextOverview[key] = value;
        }
      }
      return { ...base, overview: nextOverview };
    });
  }
}
