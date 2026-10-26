import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import type {
  IKeylessOAuthSessionIdentity,
  IKeylessOAuthSessionPersistenceJournal,
  IKeylessOAuthSessionPersistenceJournalPreparation,
  SimpleDbEntityPrime,
} from './SimpleDbEntityPrime';

export async function setKeylessOAuthSessionPersistenceJournal(
  entity: SimpleDbEntityPrime,
  preparation: IKeylessOAuthSessionPersistenceJournalPreparation,
): Promise<IKeylessOAuthSessionPersistenceJournal> {
  const persisted = await entity.setRawData((rawData) => {
    const existing = rawData?.keylessOAuthSessionPersistenceJournal;
    if (existing && existing.operationId !== preparation.operationId) {
      throw new OneKeyLocalError(
        'A Keyless OAuth session persistence operation is already pending.',
      );
    }
    const journal: IKeylessOAuthSessionPersistenceJournal = {
      ...preparation,
      expectedLifecycleRevision: rawData?.identityLifecycleRevision ?? 0,
      previousSessionCommitId:
        rawData?.authSessionCommitIdBySource?.[
          EPrimeAuthSessionSource.KeylessOAuth
        ],
      previousWalletSessionCommitId: preparation.walletId
        ? rawData?.keylessSessionCommitIdByWalletId?.[preparation.walletId]
        : undefined,
    };
    return {
      ...rawData,
      keylessOAuthSessionPersistenceJournal: journal,
    };
  });
  const journal = persisted?.keylessOAuthSessionPersistenceJournal;
  if (!journal || journal.operationId !== preparation.operationId) {
    throw new OneKeyLocalError(
      'Failed to prepare the Keyless OAuth session persistence journal.',
    );
  }
  return journal;
}

export async function commitKeylessOAuthSessionPersistenceMetadata(
  entity: SimpleDbEntityPrime,
  {
    operationId,
    persistedSessionIdentity,
    allowRevisionRebase = false,
  }: {
    operationId: string;
    persistedSessionIdentity: IKeylessOAuthSessionIdentity;
    allowRevisionRebase?: boolean;
  },
): Promise<
  | { status: 'committed'; identityLifecycleRevision: number }
  | {
      status: 'revisionChanged' | 'sessionIdentityChanged' | 'stateChanged';
    }
> {
  let result:
    | { status: 'committed'; identityLifecycleRevision: number }
    | {
        status: 'revisionChanged' | 'sessionIdentityChanged' | 'stateChanged';
      } = {
    status: 'stateChanged',
  };
  await entity.setRawData((rawData) => {
    const journal = rawData?.keylessOAuthSessionPersistenceJournal;
    if (!journal || journal.operationId !== operationId) {
      return { ...rawData };
    }
    if (
      journal.sessionTokenSub !== persistedSessionIdentity.sessionTokenSub ||
      journal.supabaseSessionId !== persistedSessionIdentity.supabaseSessionId
    ) {
      result = { status: 'sessionIdentityChanged' };
      return { ...rawData };
    }
    const currentRevision = rawData?.identityLifecycleRevision ?? 0;
    const currentSessionCommitId =
      rawData?.authSessionCommitIdBySource?.[
        EPrimeAuthSessionSource.KeylessOAuth
      ];
    const currentWalletSessionCommitId = journal.walletId
      ? rawData?.keylessSessionCommitIdByWalletId?.[journal.walletId]
      : undefined;
    if (
      currentSessionCommitId !== journal.previousSessionCommitId ||
      currentWalletSessionCommitId !== journal.previousWalletSessionCommitId
    ) {
      return { ...rawData };
    }
    if (
      currentRevision !== journal.expectedLifecycleRevision &&
      !allowRevisionRebase
    ) {
      result = { status: 'revisionChanged' };
      return { ...rawData };
    }

    const identityLifecycleRevision = currentRevision + 1;
    result = { status: 'committed', identityLifecycleRevision };
    return {
      ...rawData,
      authSessionCommitIdBySource: {
        ...rawData?.authSessionCommitIdBySource,
        [EPrimeAuthSessionSource.KeylessOAuth]: journal.sessionCommitId,
      },
      keylessSessionCommitIdByWalletId: journal.walletId
        ? {
            ...rawData?.keylessSessionCommitIdByWalletId,
            [journal.walletId]: journal.sessionCommitId,
          }
        : rawData?.keylessSessionCommitIdByWalletId,
      identityLifecycleRevision,
      keylessOAuthSessionPersistenceJournal: undefined,
    };
  });
  return result;
}

export async function removeKeylessOAuthSessionPersistenceJournal(
  entity: SimpleDbEntityPrime,
  { operationId }: { operationId: string },
): Promise<boolean> {
  let removed = false;
  await entity.setRawData((rawData) => {
    if (
      rawData?.keylessOAuthSessionPersistenceJournal?.operationId !==
      operationId
    ) {
      return { ...rawData };
    }
    removed = true;
    return {
      ...rawData,
      keylessOAuthSessionPersistenceJournal: undefined,
    };
  });
  return removed;
}
