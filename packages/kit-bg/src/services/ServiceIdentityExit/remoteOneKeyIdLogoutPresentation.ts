import type {
  IIdentityExitJournalEntry,
  SimpleDbEntityPrime,
} from '../../dbs/simple/entity/SimpleDbEntityPrime';

export async function completeRemoteOneKeyIdLogoutPresentation({
  primeDb,
  operationId,
  messageId,
  claimId,
  tombstoneTtlMs,
}: {
  primeDb: SimpleDbEntityPrime;
  operationId: string;
  messageId: string;
  claimId: string;
  tombstoneTtlMs: number;
}) {
  const timestamp = Date.now();
  let entry: IIdentityExitJournalEntry | undefined;
  try {
    entry = await primeDb.completeRemoteOneKeyIdLogoutPresentation({
      operationId,
      messageId,
      claimId,
      presentationHandledAt: timestamp,
      tombstoneExpiresAt: timestamp + tombstoneTtlMs,
    });
  } catch (error) {
    try {
      const current = (await primeDb.getIdentityExitOperationJournal())[
        operationId
      ];
      if (
        current?.remoteDeviceLogout?.messageId === messageId &&
        current.remoteDeviceLogout.presentationHandledClaimId === claimId
      ) {
        entry = current;
      }
    } catch {
      // Preserve the original write error when reconciliation cannot read.
    }
    if (!entry) {
      throw error;
    }
  }
  return entry;
}
