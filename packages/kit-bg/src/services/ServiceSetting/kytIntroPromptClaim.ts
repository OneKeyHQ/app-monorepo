import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IKytIntroClaimLease,
  IKytIntroClaimResult,
  IReceiveKytIntroEntryPoint,
} from '@onekeyhq/shared/types/kyt';

import type { ISimpleDBAppStatus } from '../../dbs/simple/entity/SimpleDbEntityAppStatus';

const KYT_INTRO_RESERVED_LEASE_MS = timerUtils.getTimeDurationMs({ minute: 5 });
const KYT_INTRO_PRESENTED_LEASE_MS = timerUtils.getTimeDurationMs({
  minute: 30,
});

// A higher-ranked entry point wins lease upgrades and may preempt an
// un-presented lease reserved by another owner.
const KYT_INTRO_ENTRY_POINT_RANK: Record<IReceiveKytIntroEntryPoint, number> = {
  homeAutoIntro: 0,
  primeSubscribeSuccess: 1,
};

type IKytIntroAppStatusStore = {
  getRawData: () => Promise<ISimpleDBAppStatus | null | undefined>;
  setRawData: (
    builder: (
      value: ISimpleDBAppStatus | null | undefined,
    ) => ISimpleDBAppStatus,
  ) => Promise<unknown>;
};

type ITryClaimKytIntroParams = {
  onekeyUserId: string;
  ownerId: string;
  entryPoint: IReceiveKytIntroEntryPoint;
  claimId?: string;
};

function getActiveLeases(
  leases: Record<string, IKytIntroClaimLease> | undefined,
  now: number,
) {
  return Object.fromEntries(
    Object.entries(leases ?? {}).filter(([, lease]) => lease.expiresAt > now),
  );
}

export class KytIntroPromptClaimManager {
  constructor(private readonly appStatus: IKytIntroAppStatusStore) {}

  // Read-only fast path for the steady state (intro completed, no lease entry
  // left for the user): lets callers skip setRawData's mutex + full-record
  // write on every launch. A lingering (even expired) lease entry falls through
  // to the write path once so it gets pruned.
  async peekCompleted(onekeyUserId: string): Promise<boolean> {
    const value = await this.appStatus.getRawData();
    return (
      !!value?.kytIntroShownUserIds?.includes(onekeyUserId) &&
      !value?.kytIntroClaimLeases?.[onekeyUserId]
    );
  }

  async tryClaim({
    onekeyUserId,
    ownerId,
    entryPoint,
    claimId,
  }: ITryClaimKytIntroParams): Promise<IKytIntroClaimResult> {
    const now = Date.now();
    let result: IKytIntroClaimResult = {
      status: 'claimedByOther',
      retryAfterMs: KYT_INTRO_RESERVED_LEASE_MS,
    };

    await this.appStatus.setRawData((value) => {
      const shownUserIds = value?.kytIntroShownUserIds ?? [];
      const leases = getActiveLeases(value?.kytIntroClaimLeases, now);

      if (shownUserIds.includes(onekeyUserId)) {
        delete leases[onekeyUserId];
        result = { status: 'shown' };
        return {
          ...value,
          kytIntroShownUserIds: shownUserIds,
          kytIntroClaimLeases: leases,
        };
      }

      const currentLease = leases[onekeyUserId];
      const isSameOwner =
        currentLease?.ownerId === ownerId &&
        ((!!claimId && currentLease.claimId === claimId) ||
          (!claimId &&
            entryPoint === 'primeSubscribeSuccess' &&
            currentLease.entryPoint === 'primeSubscribeSuccess'));
      const canPreempt =
        !!currentLease &&
        !currentLease.presentedAt &&
        KYT_INTRO_ENTRY_POINT_RANK[entryPoint] >
          KYT_INTRO_ENTRY_POINT_RANK[currentLease.entryPoint];

      if (currentLease && isSameOwner) {
        const upgradedEntryPoint =
          KYT_INTRO_ENTRY_POINT_RANK[entryPoint] >
          KYT_INTRO_ENTRY_POINT_RANK[currentLease.entryPoint]
            ? entryPoint
            : currentLease.entryPoint;
        const renewedLease: IKytIntroClaimLease = {
          ...currentLease,
          entryPoint: upgradedEntryPoint,
          expiresAt: currentLease.presentedAt
            ? now + KYT_INTRO_PRESENTED_LEASE_MS
            : now + KYT_INTRO_RESERVED_LEASE_MS,
        };
        leases[onekeyUserId] = renewedLease;
        result = {
          status: 'claimed',
          claimId: renewedLease.claimId,
          entryPoint: renewedLease.entryPoint,
        };
      } else if (currentLease && !canPreempt) {
        result = {
          status: 'claimedByOther',
          retryAfterMs: Math.max(0, currentLease.expiresAt - now),
        };
      } else {
        // No lease, or a higher-priority entry point preempts an un-presented
        // lease held by another owner.
        const newLease: IKytIntroClaimLease = {
          claimId: claimId ?? generateUUID(),
          onekeyUserId,
          ownerId,
          entryPoint,
          expiresAt: now + KYT_INTRO_RESERVED_LEASE_MS,
        };
        leases[onekeyUserId] = newLease;
        result = {
          status: 'claimed',
          claimId: newLease.claimId,
          entryPoint: newLease.entryPoint,
        };
      }

      return {
        ...value,
        kytIntroShownUserIds: shownUserIds,
        kytIntroClaimLeases: leases,
      };
    });

    return result;
  }

  async markPresented({
    onekeyUserId,
    ownerId,
    claimId,
  }: {
    onekeyUserId: string;
    ownerId: string;
    claimId: string;
  }): Promise<boolean> {
    const now = Date.now();
    let marked = false;
    await this.appStatus.setRawData((value) => {
      const leases = getActiveLeases(value?.kytIntroClaimLeases, now);
      const currentLease = leases[onekeyUserId];
      if (
        currentLease?.claimId === claimId &&
        currentLease.ownerId === ownerId
      ) {
        leases[onekeyUserId] = {
          ...currentLease,
          presentedAt: now,
          expiresAt: now + KYT_INTRO_PRESENTED_LEASE_MS,
        };
        marked = true;
      }
      return { ...value, kytIntroClaimLeases: leases };
    });
    return marked;
  }

  async release({
    onekeyUserId,
    ownerId,
    claimId,
  }: {
    onekeyUserId: string;
    ownerId: string;
    claimId: string;
  }): Promise<void> {
    const now = Date.now();
    await this.appStatus.setRawData((value) => {
      const leases = getActiveLeases(value?.kytIntroClaimLeases, now);
      const currentLease = leases[onekeyUserId];
      if (
        currentLease?.claimId === claimId &&
        currentLease.ownerId === ownerId
      ) {
        delete leases[onekeyUserId];
      }
      return { ...value, kytIntroClaimLeases: leases };
    });
  }

  async releaseForUser(onekeyUserId: string): Promise<void> {
    const now = Date.now();
    await this.appStatus.setRawData((value) => {
      const leases = getActiveLeases(value?.kytIntroClaimLeases, now);
      delete leases[onekeyUserId];
      return { ...value, kytIntroClaimLeases: leases };
    });
  }

  async complete(onekeyUserId: string): Promise<void> {
    await this.appStatus.setRawData((value) => {
      const shownUserIds = value?.kytIntroShownUserIds ?? [];
      const leases = { ...value?.kytIntroClaimLeases };
      delete leases[onekeyUserId];
      return {
        ...value,
        kytIntroShownUserIds: shownUserIds.includes(onekeyUserId)
          ? shownUserIds
          : [...shownUserIds, onekeyUserId],
        kytIntroClaimLeases: leases,
      };
    });
  }
}
