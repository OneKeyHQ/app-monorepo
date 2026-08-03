import type {
  IClaimRemoteOneKeyIdLogoutPresentationParams,
  ICompleteRemoteOneKeyIdLogoutPresentationParams,
  IIdentityExitJournalEntry,
  IRemoteOneKeyIdLogoutPresentationClaimResult,
  IUpdateRemoteOneKeyIdLogoutJournalDeliveryParams,
  SimpleDbEntityPrime,
} from './SimpleDbEntityPrime';

export async function setIdentityExitJournalEntry(
  entity: SimpleDbEntityPrime,
  entry: IIdentityExitJournalEntry,
): Promise<void> {
  await entity.setRawData((rawData) => {
    const existing = rawData?.identityExitOperationJournal?.[entry.operationId];
    const existingDelivery = existing?.remoteDeviceLogout;
    const nextDelivery = entry.remoteDeviceLogout;
    const mergedEntry =
      existingDelivery &&
      nextDelivery &&
      existingDelivery.messageId === nextDelivery.messageId
        ? {
            ...entry,
            remoteDeviceLogout: {
              ...nextDelivery,
              acknowledgedAt:
                existingDelivery.acknowledgedAt ?? nextDelivery.acknowledgedAt,
              presentationHandledAt:
                existingDelivery.presentationHandledAt ??
                nextDelivery.presentationHandledAt,
              presentationHandledClaimId:
                existingDelivery.presentationHandledClaimId ??
                nextDelivery.presentationHandledClaimId,
              presentationClaim:
                existingDelivery.presentationHandledAt ||
                nextDelivery.presentationHandledAt
                  ? undefined
                  : (existingDelivery.presentationClaim ??
                    nextDelivery.presentationClaim),
              tombstoneExpiresAt:
                existingDelivery.tombstoneExpiresAt ??
                nextDelivery.tombstoneExpiresAt,
            },
          }
        : entry;
    return {
      ...rawData,
      identityExitOperationJournal: {
        ...rawData?.identityExitOperationJournal,
        [entry.operationId]: mergedEntry,
      },
    };
  });
}

export async function updateRemoteOneKeyIdLogoutJournalDelivery(
  entity: SimpleDbEntityPrime,
  {
    operationId,
    messageId,
    acknowledgedAt,
    presentationHandledAt,
    tombstoneExpiresAt,
  }: IUpdateRemoteOneKeyIdLogoutJournalDeliveryParams,
): Promise<IIdentityExitJournalEntry | undefined> {
  let result: IIdentityExitJournalEntry | undefined;
  await entity.setRawData((rawData) => {
    const entry = rawData?.identityExitOperationJournal?.[operationId];
    if (entry?.remoteDeviceLogout?.messageId !== messageId) {
      return { ...rawData };
    }

    const remoteDeviceLogout = {
      ...entry.remoteDeviceLogout,
    };
    let changed = false;
    if (
      remoteDeviceLogout.acknowledgedAt === undefined &&
      acknowledgedAt !== undefined
    ) {
      remoteDeviceLogout.acknowledgedAt = acknowledgedAt;
      changed = true;
    }
    if (
      entry.status === 'completed' &&
      remoteDeviceLogout.presentationHandledAt === undefined &&
      presentationHandledAt !== undefined
    ) {
      remoteDeviceLogout.presentationHandledAt = presentationHandledAt;
      remoteDeviceLogout.presentationClaim = undefined;
      changed = true;
    }
    if (
      remoteDeviceLogout.acknowledgedAt !== undefined &&
      remoteDeviceLogout.presentationHandledAt !== undefined &&
      remoteDeviceLogout.tombstoneExpiresAt === undefined &&
      tombstoneExpiresAt !== undefined
    ) {
      remoteDeviceLogout.tombstoneExpiresAt = tombstoneExpiresAt;
      changed = true;
    }

    if (!changed) {
      result = entry;
      return { ...rawData };
    }
    result = {
      ...entry,
      updatedAt: Math.max(Date.now(), entry.updatedAt + 1),
      remoteDeviceLogout,
    };
    return {
      ...rawData,
      identityExitOperationJournal: {
        ...rawData?.identityExitOperationJournal,
        [operationId]: result,
      },
    };
  });
  return result;
}

export async function tryClaimRemoteOneKeyIdLogoutPresentation(
  entity: SimpleDbEntityPrime,
  {
    operationId,
    messageId,
    claimId,
    expiresAt,
    now,
  }: IClaimRemoteOneKeyIdLogoutPresentationParams,
): Promise<IRemoteOneKeyIdLogoutPresentationClaimResult> {
  let result: IRemoteOneKeyIdLogoutPresentationClaimResult = {
    status: 'unavailable',
  };
  await entity.setRawData((rawData) => {
    const entry = rawData?.identityExitOperationJournal?.[operationId];
    const delivery = entry?.remoteDeviceLogout;
    if (
      entry?.status !== 'completed' ||
      !entry.completed?.oneKeyIdLoggedOut ||
      delivery?.messageId !== messageId
    ) {
      return { ...rawData };
    }
    if (delivery.presentationHandledAt) {
      result = { status: 'handled' };
      return { ...rawData };
    }
    if (
      delivery.presentationClaim &&
      delivery.presentationClaim.expiresAt > now
    ) {
      result = {
        status: 'claimedByOther',
        retryAfterMs: delivery.presentationClaim.expiresAt - now,
      };
      return { ...rawData };
    }

    const nextEntry: IIdentityExitJournalEntry = {
      ...entry,
      updatedAt: Math.max(now, entry.updatedAt + 1),
      remoteDeviceLogout: {
        ...delivery,
        presentationClaim: {
          claimId,
          expiresAt,
        },
      },
    };
    result = {
      status: 'claimed',
      claimId,
      expiresAt,
    };
    return {
      ...rawData,
      identityExitOperationJournal: {
        ...rawData?.identityExitOperationJournal,
        [operationId]: nextEntry,
      },
    };
  });
  return result;
}

export async function completeRemoteOneKeyIdLogoutPresentation(
  entity: SimpleDbEntityPrime,
  {
    operationId,
    messageId,
    claimId,
    presentationHandledAt,
    tombstoneExpiresAt,
  }: ICompleteRemoteOneKeyIdLogoutPresentationParams,
): Promise<IIdentityExitJournalEntry | undefined> {
  let result: IIdentityExitJournalEntry | undefined;
  await entity.setRawData((rawData) => {
    const entry = rawData?.identityExitOperationJournal?.[operationId];
    const delivery = entry?.remoteDeviceLogout;
    if (
      entry?.status !== 'completed' ||
      !entry.completed?.oneKeyIdLoggedOut ||
      delivery?.messageId !== messageId
    ) {
      return { ...rawData };
    }
    if (delivery.presentationHandledAt) {
      if (delivery.presentationHandledClaimId === claimId) {
        result = entry;
      }
      return { ...rawData };
    }
    if (delivery.presentationClaim?.claimId !== claimId) {
      return { ...rawData };
    }

    result = {
      ...entry,
      updatedAt: Math.max(presentationHandledAt, entry.updatedAt + 1),
      remoteDeviceLogout: {
        ...delivery,
        presentationHandledAt,
        presentationHandledClaimId: claimId,
        presentationClaim: undefined,
        tombstoneExpiresAt: delivery.acknowledgedAt
          ? (delivery.tombstoneExpiresAt ?? tombstoneExpiresAt)
          : delivery.tombstoneExpiresAt,
      },
    };
    return {
      ...rawData,
      identityExitOperationJournal: {
        ...rawData?.identityExitOperationJournal,
        [operationId]: result,
      },
    };
  });
  return result;
}
