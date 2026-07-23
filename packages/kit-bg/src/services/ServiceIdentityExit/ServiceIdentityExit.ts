import { isEqual } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { ISupabaseJWTPayload } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  IExecuteIdentityExitParams,
  IIdentityExitIntent,
  IIdentityExitOAuthHandoff,
  IIdentityExitPlan,
  IIdentityExitPlanId,
  IIdentityExitReceipt,
} from '@onekeyhq/shared/types/prime/identityExitTypes';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { primePersistAtom } from '../../states/jotai/atoms/prime';
import {
  type IKeylessWalletRemovalIdentity,
  type IMalformedKeylessWalletFingerprint,
  createKeylessWalletRemovalCapability,
  createMalformedKeylessWalletRemovalCapability,
  getMalformedKeylessWalletDataError,
  getMalformedKeylessWalletFingerprint,
} from '../ServiceAccount/keylessWalletRemovalCapability';
import ServiceBase from '../ServiceBase';
import {
  readPersistedAccessTokenBySessionSourceStrict,
  revokeAuthSessionTokenOnServerBestEffort,
} from '../ServicePrime/primeAuthSessionAccess';

import {
  type IIdentityExitExecutionTarget,
  type IIdentityExitSnapshot,
  evaluateIdentityExitPolicy,
  getIdentityLinkage,
} from './identityExitPolicy';
import {
  beginIdentityExitReservation,
  endIdentityExitReservation,
  identityLifecycleMutex,
  markIdentityRecoveryFailed,
  markIdentityRecoveryPending,
  markIdentityRecoveryReady,
} from './identityLifecycleMutex';

import type {
  IIdentityExitJournalEntry,
  IRemoteOneKeyIdLogoutPresentationClaimResult,
} from '../../dbs/simple/entity/SimpleDbEntityPrime';

const IDENTITY_EXIT_PLAN_TTL_MS = 5 * 60 * 1000;
const IDENTITY_EXIT_OAUTH_HANDOFF_TTL_MS = 5 * 60 * 1000;
const REMOTE_DEVICE_LOGOUT_PRESENTATION_LEASE_TTL_MS = 30 * 1000;
const REMOTE_DEVICE_LOGOUT_TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const IDENTITY_EXIT_RECOVERY_SWEEP_OPERATION_ID = 'identityExit:recoverySweep';

type IReadyIdentityExitPlan = Extract<IIdentityExitPlan, { status: 'ready' }>;

type IStoredStandardIdentityExitPlan = {
  kind: 'standard';
  publicPlan: IReadyIdentityExitPlan;
  intent: IIdentityExitIntent;
  snapshot: IIdentityExitSnapshot;
  target: IIdentityExitExecutionTarget;
  operationId: string;
  executionPromise?: Promise<IIdentityExitReceipt>;
};

type IMalformedKeylessRecoveryIntent = Extract<
  IIdentityExitIntent,
  { type: 'recoverMalformedKeyless' }
>;

type IMalformedKeylessRecoverySnapshot = {
  lifecycleRevision: number;
  oneKeyId: IIdentityExitSnapshot['oneKeyId'];
  keyless: {
    fingerprint: IMalformedKeylessWalletFingerprint;
    errorMessage: string;
    ownerId?: string;
    provider?: EOAuthSocialLoginProvider;
    socialUserIdHash?: string;
    sessionCommitId?: string;
    sessionTokenSub?: string;
    walletSessionCommitId?: string;
  };
};

type IStoredMalformedKeylessRecoveryPlan = {
  kind: 'malformedKeylessRecovery';
  publicPlan: IReadyIdentityExitPlan;
  intent: IMalformedKeylessRecoveryIntent;
  snapshot: IMalformedKeylessRecoverySnapshot;
  target: IIdentityExitExecutionTarget;
  operationId: string;
  executionPromise?: Promise<IIdentityExitReceipt>;
};

type IStoredIdentityExitPlan =
  | IStoredStandardIdentityExitPlan
  | IStoredMalformedKeylessRecoveryPlan;

type IIdentityExitOAuthHandoffRecord = {
  operationId: string;
  planId: string;
  handoff: IIdentityExitOAuthHandoff;
  provider: EOAuthSocialLoginProvider;
  expectedLifecycleRevision: number;
  removedWalletId: string;
  expiresAt: number;
  consumed: boolean;
};

type ISettledIdentityExitReceiptRecord = {
  receipt: Extract<IIdentityExitReceipt, { status: 'completed' }>;
  expiresAt: number;
};

const IDENTITY_EXIT_SNAPSHOT_ERROR_CODE = Symbol(
  'identityExitSnapshotErrorCode',
);

type IIdentityExitSnapshotErrorCode = Extract<
  IIdentityExitPlan,
  { status: 'blocked' }
>['code'];

type IIdentityExitSnapshotError = OneKeyLocalError & {
  [IDENTITY_EXIT_SNAPSHOT_ERROR_CODE]: IIdentityExitSnapshotErrorCode;
};

function createIdentityExitSnapshotError(
  code: IIdentityExitSnapshotErrorCode,
  message: string,
): IIdentityExitSnapshotError {
  return Object.assign(new OneKeyLocalError(message), {
    [IDENTITY_EXIT_SNAPSHOT_ERROR_CODE]: code,
  });
}

function isIdentityExitSnapshotError(
  error: unknown,
): error is IIdentityExitSnapshotError {
  return (
    error instanceof OneKeyLocalError &&
    IDENTITY_EXIT_SNAPSHOT_ERROR_CODE in error
  );
}

function decodeSessionTokenSub(accessToken: string, field: string): string {
  const tokenSub =
    (stringUtils.decodeJWT(accessToken) as ISupabaseJWTPayload | null)?.sub ||
    '';
  if (!tokenSub) {
    // TODO: i18n
    throw createIdentityExitSnapshotError(
      'STATE_INCONSISTENT',
      `${field} token subject is unavailable.`,
    );
  }
  return tokenSub;
}

function getComparableSnapshot(snapshot: IIdentityExitSnapshot) {
  return {
    ...snapshot,
    oneKeyId:
      snapshot.oneKeyId.type === 'loggedIn'
        ? { ...snapshot.oneKeyId, accessToken: undefined }
        : snapshot.oneKeyId,
  };
}

function shouldClearKeylessSession(
  target: IIdentityExitExecutionTarget | IIdentityExitJournalEntry['target'],
): boolean {
  return target.clearKeylessSession ?? target.removeKeyless;
}

function getJournalWalletSessionCommitId(
  keyless: NonNullable<IIdentityExitJournalEntry['keyless']>,
): string | undefined {
  return 'walletSessionCommitId' in keyless
    ? (keyless.walletSessionCommitId ?? undefined)
    : keyless.sessionCommitId;
}

const planRegistry = new Map<string, IStoredIdentityExitPlan>();
const settledReceiptRegistry = new Map<
  string,
  ISettledIdentityExitReceiptRecord
>();

const ACCOUNT_DELETION_TRANSPORT_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ERR_NETWORK',
]);

function isAccountDeletionTransportOutcomeUnknown(error: unknown): boolean {
  const candidate = error as
    | {
        className?: string;
        code?: string | number;
        httpStatusCode?: number;
        response?: unknown;
      }
    | undefined;
  if (candidate?.response || typeof candidate?.httpStatusCode === 'number') {
    return false;
  }
  if (candidate?.className === EOneKeyErrorClassNames.AxiosNetworkError) {
    return true;
  }
  return (
    typeof candidate?.code === 'string' &&
    ACCOUNT_DELETION_TRANSPORT_ERROR_CODES.has(candidate.code)
  );
}

function storeIdentityExitPlan(storedPlan: IStoredIdentityExitPlan): void {
  const { planId, expiresAt } = storedPlan.publicPlan;
  planRegistry.set(planId, storedPlan);
  const expiryTimer = setTimeout(
    () => {
      const currentPlan = planRegistry.get(planId);
      if (currentPlan && currentPlan.publicPlan.expiresAt <= Date.now()) {
        planRegistry.delete(planId);
      }
    },
    Math.max(0, expiresAt - Date.now()),
  );
  (
    expiryTimer as unknown as {
      unref?: () => void;
    }
  ).unref?.();
}

function storeSettledIdentityExitReceipt({
  operationId,
  planId,
  receipt,
  expiresAt,
}: {
  operationId: string;
  planId: string;
  receipt: Extract<IIdentityExitReceipt, { status: 'completed' }>;
  expiresAt?: number;
}): void {
  const record = {
    receipt,
    expiresAt:
      expiresAt ??
      receipt.startIndependentOneKeyIdOAuth?.expiresAt ??
      Date.now() + IDENTITY_EXIT_PLAN_TTL_MS,
  };
  settledReceiptRegistry.set(planId, record);
  const expiryTimer = setTimeout(
    () => {
      const currentReceipt = settledReceiptRegistry.get(planId);
      if (currentReceipt && currentReceipt.expiresAt <= Date.now()) {
        settledReceiptRegistry.delete(planId);
      }
    },
    Math.max(0, record.expiresAt - Date.now()),
  );
  (
    expiryTimer as unknown as {
      unref?: () => void;
    }
  ).unref?.();
  // A settled receipt is only created after the completed journal is durable.
  // Keep the recovery barrier aligned with the authoritative outcome.
  markIdentityRecoveryReady(operationId);
}

function getSettledIdentityExitReceipt(
  planId: string,
): Extract<IIdentityExitReceipt, { status: 'completed' }> | undefined {
  const record = settledReceiptRegistry.get(planId);
  if (!record) {
    return undefined;
  }
  if (record.expiresAt <= Date.now()) {
    settledReceiptRegistry.delete(planId);
    return undefined;
  }
  return record.receipt;
}

export function resetIdentityExitRegistriesForTest(): void {
  if (!platformEnv.isJest) {
    throw new OneKeyLocalError(
      'Identity exit registries can only be reset in tests.',
    );
  }
  planRegistry.clear();
  settledReceiptRegistry.clear();
}

@backgroundClass()
class ServiceIdentityExit extends ServiceBase {
  private readonly identityExitJournalStorageOutcomeUnknownOperationIds =
    new Set<string>();

  private markIdentityExitJournalStorageOutcomeUnknown(
    operationId: string,
  ): void {
    this.identityExitJournalStorageOutcomeUnknownOperationIds.add(operationId);
    markIdentityRecoveryFailed(operationId);
  }

  private assertIdentityExitJournalStorageOutcomeKnown(): void {
    if (this.identityExitJournalStorageOutcomeUnknownOperationIds.size > 0) {
      // TODO: i18n
      throw new OneKeyLocalError(
        'Identity journal storage outcome is unknown. Restart the app before changing OneKey ID or Keyless state.',
      );
    }
  }

  private async persistIdentityExitJournalEntry(
    entry: IIdentityExitJournalEntry,
  ): Promise<void> {
    try {
      await this.backgroundApi.simpleDb.prime.setIdentityExitJournalEntry(
        entry,
      );
    } catch (error) {
      // A rejected storage write may still have reached the durable backend.
      // Do not recover from SimpleDB's optimistic in-memory cache in this
      // runtime; startup must reload the durable journal before proceeding.
      this.markIdentityExitJournalStorageOutcomeUnknown(entry.operationId);
      throw error;
    }
  }

  private async clearAllIdentityAuthForExplicitOperation(
    callerName: 'accountDeletion' | 'appReset',
  ): Promise<{ oneKeyIdLoggedOut: boolean }> {
    await this.recoverInterruptedIdentityExitOperations();
    return identityLifecycleMutex.runExclusive(async () => {
      const operationId = `${callerName}:${stringUtils.generateUUID()}`;
      beginIdentityExitReservation(operationId);
      let didStartRecoveryBarrier = false;
      try {
        const [user, expectedIdentityLifecycleRevision] = await Promise.all([
          primePersistAtom.get(),
          this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision(),
        ]);
        let journal: IIdentityExitJournalEntry = {
          operationId,
          planId: operationId,
          intentType: 'appReset',
          status: 'executing',
          startedAt: Date.now(),
          updatedAt: Date.now(),
          expectedLifecycleRevision: expectedIdentityLifecycleRevision,
          target: {
            logoutOneKeyId: true,
            removeKeyless: false,
            clearKeylessSession: true,
            clearAllIdentityAuth: true,
          },
        };
        markIdentityRecoveryPending(operationId);
        didStartRecoveryBarrier = true;
        await this.persistIdentityExitJournalEntry(journal);
        const result =
          await this.backgroundApi.servicePrime.clearAllIdentityAuthForExplicitOperation(
            { callerName, expectedIdentityLifecycleRevision },
          );
        if (result.status !== 'committed' || !result.revision) {
          throw new OneKeyLocalError(
            'Identity state changed before explicit auth cleanup could commit.',
          );
        }
        journal = {
          ...journal,
          status: 'localStateCommitted',
          updatedAt: Date.now(),
          committedLifecycleRevision: result.revision,
        };
        await this.persistIdentityExitJournalEntry(journal);
        await this.completeIdentityExitJournal({
          journal,
          committedLifecycleRevision: result.revision,
        });
        markIdentityRecoveryReady(operationId);
        return {
          oneKeyIdLoggedOut: Boolean(
            user.isLoggedIn && user.isLoggedInOnServer,
          ),
        };
      } catch (error) {
        if (didStartRecoveryBarrier) {
          markIdentityRecoveryFailed(operationId);
        }
        throw error;
      } finally {
        endIdentityExitReservation(operationId);
      }
    });
  }

  @backgroundMethod()
  async prepareIdentityAuthForAppReset(): Promise<void> {
    await this.clearAllIdentityAuthForExplicitOperation('appReset');
  }

  @backgroundMethod()
  async deleteOneKeyIdAccount({
    uuid,
    emailOTP,
  }: {
    uuid: string;
    emailOTP: string;
  }): Promise<{
    ok: boolean;
    oneKeyIdLoggedOut: boolean;
    serverOutcome: 'confirmed' | 'rejected' | 'unknown';
    localStateCleared: boolean;
  }> {
    await this.recoverInterruptedIdentityExitOperations();
    return identityLifecycleMutex.runExclusive(async () => {
      const operationId = `accountDeletion:${stringUtils.generateUUID()}`;
      beginIdentityExitReservation(operationId);
      let didStartRecoveryBarrier = false;
      let didSettleRecoveryBarrier = false;
      try {
        const [user, expectedLifecycleRevision] = await Promise.all([
          primePersistAtom.get(),
          this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision(),
        ]);
        if (!user.isLoggedIn || !user.isLoggedInOnServer) {
          throw new OneKeyLocalError(
            'OneKey ID must be logged in before deleting the account.',
          );
        }
        const startedAt = Date.now();
        let journal: IIdentityExitJournalEntry = {
          operationId,
          planId: operationId,
          intentType: 'deleteOneKeyIdAccount',
          status: 'serverDeletePrepared',
          startedAt,
          updatedAt: startedAt,
          expectedLifecycleRevision,
          target: {
            logoutOneKeyId: true,
            removeKeyless: false,
            clearKeylessSession: true,
            clearAllIdentityAuth: true,
          },
        };
        markIdentityRecoveryPending(operationId);
        didStartRecoveryBarrier = true;
        await this.persistIdentityExitJournalEntry(journal);
        journal = {
          ...journal,
          status: 'serverDeleteOutcomeUnknown',
          serverDeleteOutcome: 'unknown',
          updatedAt: Date.now(),
        };
        await this.persistIdentityExitJournalEntry(journal);
        let serverResult: { ok?: boolean } | undefined;
        let serverOutcome: 'confirmed' | 'rejected' | 'unknown' = 'confirmed';
        const settleServerRejection = async () => {
          serverOutcome = 'rejected';
          journal = {
            ...journal,
            status: 'serverDeleteRejected',
            serverDeleteOutcome: serverOutcome,
            updatedAt: Date.now(),
          };
          await this.persistIdentityExitJournalEntry(journal);
          const removed =
            await this.removeIdentityExitJournalEntryWithOutcomeCheck(journal);
          if (!removed) {
            throw new OneKeyLocalError(
              'The rejected account deletion journal changed unexpectedly.',
            );
          }
          markIdentityRecoveryReady(operationId);
          didSettleRecoveryBarrier = true;
        };
        try {
          serverResult =
            await this.backgroundApi.servicePrime.deleteOneKeyIdAccountOnServer(
              {
                uuid,
                emailOTP,
              },
            );
        } catch (error) {
          if (isAccountDeletionTransportOutcomeUnknown(error)) {
            // A transport interruption cannot prove whether the request
            // reached the server, so finish the authorized local cleanup
            // without claiming that server deletion succeeded.
            serverOutcome = 'unknown';
          } else {
            await settleServerRejection();
            throw error;
          }
        }
        if (serverOutcome !== 'unknown' && !serverResult?.ok) {
          await settleServerRejection();
          return {
            ok: false,
            oneKeyIdLoggedOut: false,
            serverOutcome,
            localStateCleared: false,
          };
        }

        if (serverOutcome === 'confirmed') {
          journal = {
            ...journal,
            status: 'serverDeleted',
            serverDeleteOutcome: serverOutcome,
            updatedAt: Date.now(),
          };
          await this.persistIdentityExitJournalEntry(journal);
        }
        const localCommit =
          await this.backgroundApi.servicePrime.clearAllIdentityAuthForExplicitOperation(
            {
              callerName: 'accountDeletion',
              expectedIdentityLifecycleRevision: expectedLifecycleRevision,
            },
          );
        if (localCommit.status !== 'committed' || !localCommit.revision) {
          throw new OneKeyLocalError(
            'The account was deleted, but local identity cleanup is pending recovery.',
          );
        }
        journal = {
          ...journal,
          status: 'localStateCommitted',
          updatedAt: Date.now(),
          committedLifecycleRevision: localCommit.revision,
        };
        await this.persistIdentityExitJournalEntry(journal);
        await this.completeIdentityExitJournal({
          journal,
          committedLifecycleRevision: localCommit.revision,
        });
        markIdentityRecoveryReady(operationId);
        didSettleRecoveryBarrier = true;
        return {
          ok: serverOutcome === 'confirmed',
          oneKeyIdLoggedOut: true,
          serverOutcome,
          localStateCleared: true,
        };
      } catch (error) {
        if (didStartRecoveryBarrier && !didSettleRecoveryBarrier) {
          markIdentityRecoveryFailed(operationId);
        }
        throw error;
      } finally {
        endIdentityExitReservation(operationId);
      }
    });
  }

  private async readSessionIdentity(
    source: EPrimeAuthSessionSource,
    field: string,
    expectedActiveAuthSessionSource: EPrimeAuthSessionSource | undefined,
  ): Promise<{
    accessToken: string;
    sessionTokenSub: string;
    sessionCommitId: string;
  }> {
    const slot = await readPersistedAccessTokenBySessionSourceStrict(source);
    if (slot.status !== 'ok') {
      // TODO: i18n
      throw createIdentityExitSnapshotError(
        'STATE_INCONSISTENT',
        `${field} session slot is ${slot.status}.`,
      );
    }
    const sessionTokenSub = decodeSessionTokenSub(slot.accessToken, field);
    let persistedSessionCommitId =
      await this.backgroundApi.simpleDb.prime.getAuthSessionCommitId(source);
    persistedSessionCommitId ??=
      await this.backgroundApi.simpleDb.prime.backfillAuthSessionCommitIdForMigration(
        {
          authSessionSource: source,
          expectedActiveAuthSessionSource,
        },
      );
    if (!persistedSessionCommitId) {
      // TODO: i18n
      throw createIdentityExitSnapshotError(
        'STATE_INCONSISTENT',
        `${field} session commit identity is unavailable.`,
      );
    }
    return {
      accessToken: slot.accessToken,
      sessionTokenSub,
      sessionCommitId: persistedSessionCommitId,
    };
  }

  private async buildOneKeyIdSnapshot({
    oneKeyIdAuthState,
    primeUser,
    source,
    tolerateUnavailableKeylessSession = false,
  }: {
    oneKeyIdAuthState: 'loggedIn' | 'loggedOut' | undefined;
    primeUser: Awaited<ReturnType<typeof primePersistAtom.get>>;
    source: EPrimeAuthSessionSource | undefined;
    tolerateUnavailableKeylessSession?: boolean;
  }): Promise<IIdentityExitSnapshot['oneKeyId']> {
    if (primeUser.isLoggedIn !== primeUser.isLoggedInOnServer) {
      throw createIdentityExitSnapshotError(
        'STATE_INCONSISTENT',
        'OneKey ID local and server login projections are inconsistent.',
      );
    }

    if (primeUser.isLoggedIn && primeUser.isLoggedInOnServer) {
      if (!source || oneKeyIdAuthState === 'loggedOut') {
        throw createIdentityExitSnapshotError(
          'STATE_INCONSISTENT',
          'OneKey ID is logged in but its local auth source is unavailable.',
        );
      }
      if (!primeUser.onekeyUserId) {
        throw createIdentityExitSnapshotError(
          'STATE_INCONSISTENT',
          'OneKey ID onekeyUserId is unavailable.',
        );
      }
      let identity: Awaited<
        ReturnType<ServiceIdentityExit['readSessionIdentity']>
      >;
      try {
        identity = await this.readSessionIdentity(source, 'OneKey ID', source);
      } catch (error) {
        if (
          !tolerateUnavailableKeylessSession ||
          source !== EPrimeAuthSessionSource.KeylessOAuth
        ) {
          throw error;
        }
        const [slot, sessionCommitId] = await Promise.all([
          readPersistedAccessTokenBySessionSourceStrict(source),
          this.backgroundApi.simpleDb.prime.getAuthSessionCommitId(source),
        ]);
        let sessionTokenSub: string | undefined;
        if (slot.status === 'ok') {
          try {
            sessionTokenSub = decodeSessionTokenSub(
              slot.accessToken,
              'OneKey ID',
            );
          } catch {
            sessionTokenSub = undefined;
          }
        }
        identity = {
          accessToken: slot.status === 'ok' ? slot.accessToken : '',
          sessionCommitId: sessionCommitId || '',
          sessionTokenSub: sessionTokenSub || '',
        };
      }
      return {
        type: 'loggedIn',
        onekeyUserId: primeUser.onekeyUserId,
        source,
        ...identity,
      };
    }

    if (source || oneKeyIdAuthState === 'loggedIn') {
      throw createIdentityExitSnapshotError(
        'STATE_INCONSISTENT',
        'OneKey ID is logged out but an active auth source is still set.',
      );
    }
    return { type: 'loggedOut' };
  }

  private async readAuthoritativeSnapshot(): Promise<IIdentityExitSnapshot> {
    const [lifecycleRevision, oneKeyIdAuthState, primeUser, source, wallet] =
      await Promise.all([
        this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision(),
        this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
        primePersistAtom.get(),
        this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource(),
        this.backgroundApi.serviceAccount.getIdentityManagedKeylessWalletCandidate(),
      ]);

    const oneKeyId = await this.buildOneKeyIdSnapshot({
      oneKeyIdAuthState,
      primeUser,
      source,
    });

    let keyless: IIdentityExitSnapshot['keyless'] = { type: 'absent' };
    if (wallet) {
      const malformedDataError = getMalformedKeylessWalletDataError(wallet);
      if (malformedDataError) {
        throw createIdentityExitSnapshotError(
          'KEYLESS_DATA_MALFORMED',
          malformedDataError,
        );
      }
      const ownerId = wallet.keylessDetailsInfo?.keylessOwnerId;
      const provider = wallet.keylessDetailsInfo?.keylessProvider;
      const socialUserIdHash = wallet.keylessDetailsInfo?.socialUserIdHash;
      // TODO: i18n
      if (!ownerId) {
        throw createIdentityExitSnapshotError(
          'KEYLESS_DATA_MALFORMED',
          'Keyless wallet keylessDetailsInfo.keylessOwnerId is missing.',
        );
      }
      // TODO: i18n
      if (!provider) {
        throw createIdentityExitSnapshotError(
          'KEYLESS_DATA_MALFORMED',
          'Keyless wallet keylessDetailsInfo.keylessProvider is missing.',
        );
      }
      if (
        provider !== EOAuthSocialLoginProvider.Google &&
        provider !== EOAuthSocialLoginProvider.Apple
      ) {
        // TODO: i18n
        throw createIdentityExitSnapshotError(
          'KEYLESS_DATA_MALFORMED',
          `Keyless wallet keylessDetailsInfo.keylessProvider is invalid: ${String(
            provider,
          )}.`,
        );
      }
      // TODO: i18n
      if (!socialUserIdHash) {
        throw createIdentityExitSnapshotError(
          'KEYLESS_DATA_MALFORMED',
          'Keyless wallet keylessDetailsInfo.socialUserIdHash is missing.',
        );
      }

      const [
        keylessSlot,
        persistedSourceSessionCommitId,
        walletSessionCommitId,
      ] = await Promise.all([
        readPersistedAccessTokenBySessionSourceStrict(
          EPrimeAuthSessionSource.KeylessOAuth,
        ),
        this.backgroundApi.simpleDb.prime.getAuthSessionCommitId(
          EPrimeAuthSessionSource.KeylessOAuth,
        ),
        this.backgroundApi.simpleDb.prime.getKeylessSessionCommitId({
          walletId: wallet.id,
        }),
      ]);
      let sessionCommitId: string | undefined;
      let sessionTokenSub: string | undefined;
      let sessionIdentityStatus: 'verified' | 'unknown' = 'verified';
      let sessionIdentityError: string | undefined;
      const markSessionIdentityUnknown = (message: string) => {
        sessionIdentityStatus = 'unknown';
        sessionIdentityError ??= message;
      };
      if (keylessSlot.status === 'corrupt') {
        // TODO: i18n
        markSessionIdentityUnknown('Keyless OAuth session slot is corrupt.');
        sessionCommitId = persistedSourceSessionCommitId;
      } else if (keylessSlot.status === 'ok') {
        try {
          sessionTokenSub = decodeSessionTokenSub(
            keylessSlot.accessToken,
            'Keyless OAuth',
          );
        } catch (error) {
          markSessionIdentityUnknown(
            error instanceof Error && error.message
              ? error.message
              : 'Keyless OAuth token subject is unavailable.',
          );
        }
        if (sessionTokenSub) {
          try {
            const validation =
              await this.backgroundApi.serviceKeylessWallet.validateTokenMatchesKeylessWallet(
                {
                  token: keylessSlot.accessToken,
                  skipFixProvider: true,
                },
              );
            if (!validation.isValid) {
              // TODO: i18n
              markSessionIdentityUnknown(
                'The Keyless OAuth session does not match the local Keyless wallet.',
              );
            }
          } catch (error) {
            markSessionIdentityUnknown(
              error instanceof Error && error.message
                ? error.message
                : 'The Keyless OAuth session identity could not be verified.',
            );
          }
        }
        let sourceSessionCommitId = persistedSourceSessionCommitId;
        if (sessionIdentityStatus === 'verified') {
          sourceSessionCommitId ??=
            await this.backgroundApi.simpleDb.prime.backfillAuthSessionCommitIdForMigration(
              {
                authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
                expectedActiveAuthSessionSource: source,
                preferredSessionCommitId: walletSessionCommitId,
              },
            );
          if (!sourceSessionCommitId) {
            // TODO: i18n
            markSessionIdentityUnknown(
              'Keyless OAuth session commit identity is unavailable.',
            );
          }
        }
        sessionCommitId = sourceSessionCommitId;
        if (
          walletSessionCommitId &&
          walletSessionCommitId !== sessionCommitId
        ) {
          // TODO: i18n
          markSessionIdentityUnknown(
            'The Keyless wallet session commit identity is inconsistent.',
          );
        }
      } else {
        if (
          persistedSourceSessionCommitId &&
          walletSessionCommitId &&
          persistedSourceSessionCommitId !== walletSessionCommitId
        ) {
          // TODO: i18n
          markSessionIdentityUnknown(
            'The empty Keyless session has inconsistent persisted commit identities.',
          );
        }
        sessionCommitId =
          persistedSourceSessionCommitId || walletSessionCommitId;
      }

      keyless = {
        type: 'present',
        walletId: wallet.id,
        ownerId,
        provider,
        socialUserIdHash,
        sessionCommitId,
        sessionTokenSub,
        walletSessionCommitId,
        sessionIdentityStatus,
        sessionIdentityError,
      };
    }

    return { lifecycleRevision, oneKeyId, keyless };
  }

  private async readMalformedKeylessRecoverySnapshot(): Promise<IMalformedKeylessRecoverySnapshot> {
    const [lifecycleRevision, oneKeyIdAuthState, primeUser, source, wallet] =
      await Promise.all([
        this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision(),
        this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
        primePersistAtom.get(),
        this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource(),
        this.backgroundApi.serviceAccount.getIdentityManagedKeylessWalletCandidate(),
      ]);
    if (!wallet) {
      throw createIdentityExitSnapshotError(
        'INTENT_NOT_APPLICABLE',
        'The local Keyless wallet is no longer available.',
      );
    }
    const errorMessage = getMalformedKeylessWalletDataError(wallet);
    if (!errorMessage) {
      throw createIdentityExitSnapshotError(
        'INTENT_NOT_APPLICABLE',
        'The local Keyless wallet data is no longer malformed.',
      );
    }
    const oneKeyId = await this.buildOneKeyIdSnapshot({
      oneKeyIdAuthState,
      primeUser,
      source,
      tolerateUnavailableKeylessSession: true,
    });
    const fingerprint = getMalformedKeylessWalletFingerprint(wallet);
    const [slot, sessionCommitId, walletSessionCommitId] = await Promise.all([
      readPersistedAccessTokenBySessionSourceStrict(
        EPrimeAuthSessionSource.KeylessOAuth,
      ),
      this.backgroundApi.simpleDb.prime.getAuthSessionCommitId(
        EPrimeAuthSessionSource.KeylessOAuth,
      ),
      this.backgroundApi.simpleDb.prime.getKeylessSessionCommitId({
        walletId: wallet.id,
      }),
    ]);
    let sessionTokenSub: string | undefined;
    if (slot.status === 'ok') {
      try {
        sessionTokenSub = decodeSessionTokenSub(
          slot.accessToken,
          'Keyless OAuth',
        );
      } catch {
        sessionTokenSub = undefined;
      }
    }
    const provider =
      fingerprint.keylessProvider === EOAuthSocialLoginProvider.Google ||
      fingerprint.keylessProvider === EOAuthSocialLoginProvider.Apple
        ? fingerprint.keylessProvider
        : undefined;
    return {
      lifecycleRevision,
      oneKeyId,
      keyless: {
        fingerprint,
        errorMessage,
        ownerId: fingerprint.keylessOwnerId || undefined,
        provider,
        socialUserIdHash: fingerprint.socialUserIdHash || undefined,
        sessionCommitId,
        sessionTokenSub,
        walletSessionCommitId,
      },
    };
  }

  private async prepareMalformedKeylessRecoveryUnderLock(
    intent: IMalformedKeylessRecoveryIntent,
  ): Promise<IIdentityExitPlan> {
    const snapshot = await this.readMalformedKeylessRecoverySnapshot();
    if (snapshot.keyless.fingerprint.walletId !== intent.expectedWalletId) {
      throw createIdentityExitSnapshotError(
        'STATE_INCONSISTENT',
        `Keyless wallet changed: expected ${intent.expectedWalletId}, received ${snapshot.keyless.fingerprint.walletId}.`,
      );
    }
    if (
      intent.scene === 'oneKeyIdLogin' &&
      snapshot.oneKeyId.type === 'loggedIn'
    ) {
      throw createIdentityExitSnapshotError(
        'STATE_INCONSISTENT',
        'OneKey ID became logged in before Keyless recovery started.',
      );
    }
    const shouldLogoutOneKeyId =
      snapshot.oneKeyId.type === 'loggedIn' &&
      snapshot.oneKeyId.source === EPrimeAuthSessionSource.KeylessOAuth;
    const target: IIdentityExitExecutionTarget = {
      logoutOneKeyId: shouldLogoutOneKeyId,
      removeKeyless: true,
      clearKeylessSession: true,
      allowUnknownKeylessSessionIdentity: true,
      ...(intent.scene === 'oneKeyIdLogin'
        ? { switchOAuthProvider: intent.nextProvider }
        : {}),
    };
    const planId = stringUtils.generateUUID() as IIdentityExitPlanId;
    const publicPlan: IReadyIdentityExitPlan = {
      status: 'ready',
      planId,
      expiresAt: Date.now() + IDENTITY_EXIT_PLAN_TTL_MS,
      presentation: {
        type: 'recoverMalformedKeyless',
        nextProvider: intent.nextProvider,
        oneKeyIdWillBeLoggedOut: shouldLogoutOneKeyId,
      },
      confirmation: { type: 'keylessRemovalAcknowledgement' },
    };
    storeIdentityExitPlan({
      kind: 'malformedKeylessRecovery',
      publicPlan,
      intent,
      snapshot,
      target,
      operationId: stringUtils.generateUUID(),
    });
    return publicPlan;
  }

  @backgroundMethod()
  async prepareIdentityExit(
    intent: IIdentityExitIntent,
  ): Promise<IIdentityExitPlan> {
    try {
      await this.recoverInterruptedIdentityExitOperations();
      return await identityLifecycleMutex.runExclusive(async () => {
        if (intent.type === 'recoverMalformedKeyless') {
          return this.prepareMalformedKeylessRecoveryUnderLock(intent);
        }
        let snapshot: IIdentityExitSnapshot;
        try {
          snapshot = await this.readAuthoritativeSnapshot();
        } catch (error) {
          if (
            intent.type === 'removeKeyless' &&
            intent.scene === 'accountSelector' &&
            isIdentityExitSnapshotError(error) &&
            error[IDENTITY_EXIT_SNAPSHOT_ERROR_CODE] ===
              'KEYLESS_DATA_MALFORMED'
          ) {
            return this.prepareMalformedKeylessRecoveryUnderLock({
              type: 'recoverMalformedKeyless',
              expectedWalletId: intent.expectedWalletId,
              scene: 'accountSelector',
            });
          }
          throw error;
        }
        const policy = evaluateIdentityExitPolicy({ intent, snapshot });
        if (policy.status === 'blocked') {
          return policy;
        }
        const planId = stringUtils.generateUUID() as IIdentityExitPlanId;
        const publicPlan: IReadyIdentityExitPlan = {
          status: 'ready',
          planId,
          expiresAt: Date.now() + IDENTITY_EXIT_PLAN_TTL_MS,
          presentation: policy.presentation,
          confirmation: policy.confirmation,
        };
        storeIdentityExitPlan({
          kind: 'standard',
          publicPlan,
          intent,
          snapshot,
          target: policy.target,
          operationId: stringUtils.generateUUID(),
        });
        return publicPlan;
      });
    } catch (error) {
      if (isIdentityExitSnapshotError(error)) {
        return {
          status: 'blocked',
          code: error[IDENTITY_EXIT_SNAPSHOT_ERROR_CODE],
          message: error.message,
        };
      }
      // TODO: i18n
      const fallbackMessage = 'Identity state is unavailable.';
      const message =
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage;
      return { status: 'blocked', code: 'STATE_UNAVAILABLE', message };
    }
  }

  private buildJournalEntry({
    storedPlan,
    snapshot,
  }: {
    storedPlan: IStoredStandardIdentityExitPlan;
    snapshot: IIdentityExitSnapshot;
  }): IIdentityExitJournalEntry {
    return {
      operationId: storedPlan.operationId,
      planId: storedPlan.publicPlan.planId,
      intentType: storedPlan.intent.type,
      status: 'executing',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      expectedLifecycleRevision: snapshot.lifecycleRevision,
      target: storedPlan.target,
      oneKeyId:
        snapshot.oneKeyId.type === 'loggedIn'
          ? {
              onekeyUserId: snapshot.oneKeyId.onekeyUserId,
              source: snapshot.oneKeyId.source,
              sessionCommitId: snapshot.oneKeyId.sessionCommitId,
              sessionTokenSub: snapshot.oneKeyId.sessionTokenSub,
            }
          : undefined,
      keyless:
        snapshot.keyless.type === 'present'
          ? {
              walletId: snapshot.keyless.walletId,
              ownerId: snapshot.keyless.ownerId,
              provider: snapshot.keyless.provider,
              socialUserIdHash: snapshot.keyless.socialUserIdHash,
              sessionCommitId: snapshot.keyless.sessionCommitId,
              sessionTokenSub: snapshot.keyless.sessionTokenSub,
              walletSessionCommitId:
                snapshot.keyless.walletSessionCommitId ?? null,
            }
          : undefined,
    };
  }

  private buildMalformedKeylessRecoveryJournal({
    storedPlan,
    snapshot,
  }: {
    storedPlan: IStoredMalformedKeylessRecoveryPlan;
    snapshot: IMalformedKeylessRecoverySnapshot;
  }): IIdentityExitJournalEntry {
    return {
      operationId: storedPlan.operationId,
      planId: storedPlan.publicPlan.planId,
      intentType: storedPlan.intent.type,
      status: 'executing',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      expectedLifecycleRevision: snapshot.lifecycleRevision,
      target: storedPlan.target,
      oneKeyId:
        snapshot.oneKeyId.type === 'loggedIn'
          ? {
              onekeyUserId: snapshot.oneKeyId.onekeyUserId,
              source: snapshot.oneKeyId.source,
              sessionCommitId: snapshot.oneKeyId.sessionCommitId,
              sessionTokenSub: snapshot.oneKeyId.sessionTokenSub || undefined,
            }
          : undefined,
      keyless: {
        walletId: snapshot.keyless.fingerprint.walletId,
        ownerId: snapshot.keyless.ownerId,
        provider: snapshot.keyless.provider,
        socialUserIdHash: snapshot.keyless.socialUserIdHash,
        malformedDataError: snapshot.keyless.errorMessage,
        sessionCommitId: snapshot.keyless.sessionCommitId,
        sessionTokenSub: snapshot.keyless.sessionTokenSub,
        walletSessionCommitId: snapshot.keyless.walletSessionCommitId ?? null,
      },
    };
  }

  private buildReceiptFromCompletedJournal(
    journal: IIdentityExitJournalEntry,
  ): IIdentityExitReceipt | undefined {
    if (journal.status !== 'completed' || !journal.completed) {
      return undefined;
    }
    const hasLiveOAuthHandoff = Boolean(
      journal.completed.oauthHandoff &&
      journal.completed.oauthProvider &&
      journal.completed.oauthHandoffExpiresAt &&
      journal.completed.oauthHandoffExpiresAt > Date.now() &&
      !journal.completed.oauthHandoffConsumedAt,
    );
    return {
      status: 'completed',
      oneKeyIdLoggedOut: journal.completed.oneKeyIdLoggedOut,
      removedWalletId: journal.completed.removedWalletId,
      startIndependentOneKeyIdOAuth:
        hasLiveOAuthHandoff &&
        journal.completed.oauthHandoff &&
        journal.completed.oauthProvider &&
        journal.completed.oauthHandoffExpiresAt
          ? {
              provider: journal.completed.oauthProvider,
              handoff: journal.completed
                .oauthHandoff as IIdentityExitOAuthHandoff,
              expiresAt: journal.completed.oauthHandoffExpiresAt,
            }
          : undefined,
    };
  }

  private buildOAuthHandoffRecordFromCompletedJournal(
    journal: IIdentityExitJournalEntry,
  ): IIdentityExitOAuthHandoffRecord | undefined {
    if (
      journal.status !== 'completed' ||
      !journal.completed?.oauthHandoff ||
      !journal.completed.oauthProvider ||
      !journal.completed.oauthHandoffExpiresAt ||
      journal.completed.oauthExpectedLifecycleRevision === undefined ||
      !journal.keyless?.walletId
    ) {
      return undefined;
    }
    return {
      operationId: journal.operationId,
      planId: journal.planId,
      handoff: journal.completed.oauthHandoff as IIdentityExitOAuthHandoff,
      provider: journal.completed.oauthProvider,
      expectedLifecycleRevision:
        journal.completed.oauthExpectedLifecycleRevision,
      removedWalletId: journal.keyless.walletId,
      expiresAt: journal.completed.oauthHandoffExpiresAt,
      consumed: Boolean(journal.completed.oauthHandoffConsumedAt),
    };
  }

  private async removeCompletedIdentityExitJournalEntry(
    journal: IIdentityExitJournalEntry,
  ): Promise<void> {
    const removed =
      await this.removeIdentityExitJournalEntryWithOutcomeCheck(journal);
    if (!removed) {
      throw new OneKeyLocalError(
        'The completed identity exit journal changed before cleanup.',
      );
    }
  }

  private async removeIdentityExitJournalEntryWithOutcomeCheck(
    journal: IIdentityExitJournalEntry,
  ): Promise<boolean> {
    try {
      const removed =
        await this.backgroundApi.simpleDb.prime.removeIdentityExitJournalEntry({
          operationId: journal.operationId,
          expectedUpdatedAt: journal.updatedAt,
        });
      if (removed) {
        return true;
      }
      const currentJournal =
        await this.backgroundApi.simpleDb.prime.getIdentityExitOperationJournal();
      return !currentJournal[journal.operationId];
    } catch (error) {
      try {
        const currentJournal =
          await this.backgroundApi.simpleDb.prime.getIdentityExitOperationJournal();
        if (!currentJournal[journal.operationId]) {
          return true;
        }
      } catch {
        // Preserve the original deletion error when its outcome cannot be read.
      }
      throw error;
    }
  }

  private async removeCompletedIdentityExitJournalEntryBestEffort(
    journal: IIdentityExitJournalEntry,
  ): Promise<void> {
    try {
      await this.removeCompletedIdentityExitJournalEntry(journal);
    } catch {
      // The completed journal is recovery metadata after the identity outcome
      // has committed. A later recovery sweep can retry this housekeeping.
    }
  }

  private scheduleOAuthHandoffJournalExpiryCleanup(
    record: IIdentityExitOAuthHandoffRecord,
  ): void {
    const expiryTimer = setTimeout(
      () => {
        void this.cleanupExpiredOAuthHandoffJournal(record);
      },
      Math.max(0, record.expiresAt - Date.now()),
    );
    (
      expiryTimer as unknown as {
        unref?: () => void;
      }
    ).unref?.();
  }

  private async cleanupExpiredOAuthHandoffJournal(
    record: IIdentityExitOAuthHandoffRecord,
  ): Promise<void> {
    if (record.expiresAt > Date.now()) {
      return;
    }
    settledReceiptRegistry.delete(record.planId);
    try {
      const journal =
        await this.backgroundApi.simpleDb.prime.getIdentityExitOperationJournal();
      const entry = journal[record.operationId];
      if (
        entry?.status === 'completed' &&
        entry.completed?.oauthHandoff === record.handoff &&
        entry.completed.oauthHandoffExpiresAt === record.expiresAt
      ) {
        await this.removeCompletedIdentityExitJournalEntry(entry);
      }
    } catch {
      // Startup recovery provides the durable fallback when timer cleanup
      // cannot reach storage, including after a suspended BG runtime resumes.
    }
  }

  private scheduleRemoteDeviceLogoutJournalExpiryCleanup(
    journal: IIdentityExitJournalEntry,
  ): void {
    const delivery = journal.remoteDeviceLogout;
    if (
      journal.status !== 'completed' ||
      !delivery?.acknowledgedAt ||
      !delivery.presentationHandledAt ||
      !delivery.tombstoneExpiresAt
    ) {
      return;
    }
    const expiryTimer = setTimeout(
      () => {
        void this.cleanupExpiredRemoteDeviceLogoutJournal(journal);
      },
      Math.max(0, delivery.tombstoneExpiresAt - Date.now()),
    );
    (
      expiryTimer as unknown as {
        unref?: () => void;
      }
    ).unref?.();
  }

  private async cleanupExpiredRemoteDeviceLogoutJournal(
    journal: IIdentityExitJournalEntry,
  ): Promise<void> {
    const expectedDelivery = journal.remoteDeviceLogout;
    if (
      !expectedDelivery?.tombstoneExpiresAt ||
      expectedDelivery.tombstoneExpiresAt > Date.now()
    ) {
      return;
    }
    try {
      const current = (
        await this.backgroundApi.simpleDb.prime.getIdentityExitOperationJournal()
      )[journal.operationId];
      if (
        current?.status === 'completed' &&
        current.remoteDeviceLogout?.messageId === expectedDelivery.messageId &&
        current.remoteDeviceLogout.acknowledgedAt &&
        current.remoteDeviceLogout.presentationHandledAt &&
        current.remoteDeviceLogout.tombstoneExpiresAt ===
          expectedDelivery.tombstoneExpiresAt
      ) {
        await this.removeCompletedIdentityExitJournalEntry(current);
        settledReceiptRegistry.delete(current.planId);
      }
    } catch {
      // A later recovery sweep retries tombstone cleanup from durable state.
    }
  }

  private async retainLiveOAuthHandoffOrRemoveCompletedJournal(
    journal: IIdentityExitJournalEntry,
  ): Promise<boolean> {
    if (journal.remoteDeviceLogout) {
      const delivery = journal.remoteDeviceLogout;
      if (
        delivery.acknowledgedAt &&
        delivery.presentationHandledAt &&
        delivery.tombstoneExpiresAt &&
        delivery.tombstoneExpiresAt <= Date.now()
      ) {
        await this.removeCompletedIdentityExitJournalEntryBestEffort(journal);
        settledReceiptRegistry.delete(journal.planId);
        return false;
      }
      this.scheduleRemoteDeviceLogoutJournalExpiryCleanup(journal);
      return true;
    }
    const record = this.buildOAuthHandoffRecordFromCompletedJournal(journal);
    if (record && !record.consumed && record.expiresAt > Date.now()) {
      this.scheduleOAuthHandoffJournalExpiryCleanup(record);
      return true;
    }
    await this.removeCompletedIdentityExitJournalEntryBestEffort(journal);
    return false;
  }

  private async completeIdentityExitJournal({
    journal,
    committedLifecycleRevision,
    oneKeyIdLoggedOut = journal.target.logoutOneKeyId,
  }: {
    journal: IIdentityExitJournalEntry;
    committedLifecycleRevision: number;
    oneKeyIdLoggedOut?: boolean;
  }): Promise<IIdentityExitReceipt> {
    let oauthHandoffRecord: IIdentityExitOAuthHandoffRecord | undefined;
    if (journal.target.switchOAuthProvider && journal.keyless?.walletId) {
      const handoff =
        (journal.completed?.oauthHandoff as
          | IIdentityExitOAuthHandoff
          | undefined) ||
        (stringUtils.generateUUID() as IIdentityExitOAuthHandoff);
      oauthHandoffRecord = {
        operationId: journal.operationId,
        planId: journal.planId,
        handoff,
        provider: journal.target.switchOAuthProvider,
        expectedLifecycleRevision: committedLifecycleRevision,
        removedWalletId: journal.keyless.walletId,
        expiresAt:
          journal.completed?.oauthHandoffExpiresAt ||
          Date.now() + IDENTITY_EXIT_OAUTH_HANDOFF_TTL_MS,
        consumed: Boolean(journal.completed?.oauthHandoffConsumedAt),
      };
    }

    const completedJournal: IIdentityExitJournalEntry = {
      ...journal,
      status: 'completed',
      updatedAt: Date.now(),
      committedLifecycleRevision,
      completed: {
        oneKeyIdLoggedOut,
        removedWalletId: journal.target.removeKeyless
          ? journal.keyless?.walletId
          : undefined,
        oauthHandoff: oauthHandoffRecord?.handoff,
        oauthProvider: oauthHandoffRecord?.provider,
        oauthHandoffExpiresAt: oauthHandoffRecord?.expiresAt,
        oauthExpectedLifecycleRevision:
          oauthHandoffRecord?.expectedLifecycleRevision,
        oauthHandoffConsumedAt: journal.completed?.oauthHandoffConsumedAt,
      },
    };
    await this.persistIdentityExitJournalEntry(completedJournal);
    const receipt = this.buildReceiptFromCompletedJournal(completedJournal);
    if (!receipt || receipt.status !== 'completed') {
      throw new OneKeyLocalError(
        'Identity exit journal completion did not produce a receipt.',
      );
    }
    await this.markRemoteDeviceLogoutNoopPresentationHandled({
      journal: completedJournal,
      receipt,
    });
    storeSettledIdentityExitReceipt({
      operationId: completedJournal.operationId,
      planId: completedJournal.planId,
      receipt,
      expiresAt: oauthHandoffRecord?.expiresAt,
    });
    if (completedJournal.remoteDeviceLogout && receipt.oneKeyIdLoggedOut) {
      appEventBus.emit(EAppEventBusNames.PrimeDeviceLogout, {
        operationId: completedJournal.operationId,
        messageId: completedJournal.remoteDeviceLogout.messageId,
      });
    }
    if (oauthHandoffRecord) {
      this.scheduleOAuthHandoffJournalExpiryCleanup(oauthHandoffRecord);
    } else if (completedJournal.remoteDeviceLogout) {
      this.scheduleRemoteDeviceLogoutJournalExpiryCleanup(completedJournal);
    } else {
      await this.removeCompletedIdentityExitJournalEntryBestEffort(
        completedJournal,
      );
    }
    return receipt;
  }

  private async markRemoteDeviceLogoutNoopPresentationHandled({
    journal,
    receipt,
  }: {
    journal: IIdentityExitJournalEntry;
    receipt: IIdentityExitReceipt;
  }): Promise<void> {
    if (
      receipt.status !== 'completed' ||
      receipt.oneKeyIdLoggedOut ||
      !journal.remoteDeviceLogout ||
      journal.remoteDeviceLogout.presentationHandledAt
    ) {
      return;
    }
    await this.markRemoteOneKeyIdLogoutNotificationDelivered({
      operationId: journal.operationId,
      messageId: journal.remoteDeviceLogout.messageId,
      delivery: 'presentationHandled',
    });
  }

  private async cleanupRemovedKeylessWalletCredentials(
    journal: IIdentityExitJournalEntry,
  ): Promise<void> {
    if (!journal.target.removeKeyless || !journal.keyless) {
      return;
    }
    await this.backgroundApi.serviceAccount.cleanupChildBotWalletsForRemovedKeylessParent(
      { walletId: journal.keyless.walletId },
    );
    if (journal.keyless.ownerId) {
      await this.backgroundApi.serviceKeylessWallet.cleanupKeylessWalletCredentialStorage(
        { ownerId: journal.keyless.ownerId },
      );
    }
  }

  private async finalizeRemovedKeylessWalletSideEffectsBestEffort(
    journal: IIdentityExitJournalEntry,
  ): Promise<void> {
    if (!journal.target.removeKeyless || !journal.keyless) {
      return;
    }
    try {
      await this.backgroundApi.serviceAccount.finalizeRemovedKeylessWalletSideEffects(
        { walletId: journal.keyless.walletId },
      );
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
    }
  }

  private async getKeylessWalletForJournalRecovery(
    journal: IIdentityExitJournalEntry,
  ) {
    if (journal.intentType === 'recoverMalformedKeyless') {
      return this.backgroundApi.serviceAccount.getIdentityManagedKeylessWalletCandidate();
    }
    return this.backgroundApi.serviceAccount.getKeylessWallet();
  }

  private async isJournalLocalCommitApplied(
    journal: IIdentityExitJournalEntry,
  ): Promise<number | undefined> {
    const committedLifecycleRevision =
      journal.committedLifecycleRevision ??
      journal.expectedLifecycleRevision + 1;
    const [revision, source, authState, primeUser, wallet] = await Promise.all([
      this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision(),
      this.backgroundApi.simpleDb.prime.getAuthSessionSource(),
      this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
      primePersistAtom.get(),
      this.getKeylessWalletForJournalRecovery(journal),
    ]);
    if (revision !== committedLifecycleRevision) {
      return undefined;
    }

    if (journal.target.logoutOneKeyId && journal.oneKeyId) {
      const [sessionCommitId, slot] = await Promise.all([
        this.backgroundApi.simpleDb.prime.getAuthSessionCommitId(
          journal.oneKeyId.source,
        ),
        readPersistedAccessTokenBySessionSourceStrict(journal.oneKeyId.source),
      ]);
      if (
        source ||
        authState !== 'loggedOut' ||
        primeUser.isLoggedIn ||
        primeUser.isLoggedInOnServer ||
        sessionCommitId ||
        slot.status !== 'empty'
      ) {
        return undefined;
      }
    } else if (journal.oneKeyId) {
      const sessionCommitId =
        await this.backgroundApi.simpleDb.prime.getAuthSessionCommitId(
          journal.oneKeyId.source,
        );
      if (
        source !== journal.oneKeyId.source ||
        authState === 'loggedOut' ||
        !primeUser.isLoggedIn ||
        !primeUser.isLoggedInOnServer ||
        primeUser.onekeyUserId !== journal.oneKeyId.onekeyUserId ||
        sessionCommitId !== journal.oneKeyId.sessionCommitId
      ) {
        return undefined;
      }
    }

    if (journal.target.removeKeyless && journal.keyless) {
      const walletSessionCommitId =
        await this.backgroundApi.simpleDb.prime.getKeylessSessionCommitId({
          walletId: journal.keyless.walletId,
        });
      if (wallet || walletSessionCommitId) {
        return undefined;
      }
      if (shouldClearKeylessSession(journal.target)) {
        const [sessionCommitId, slot] = await Promise.all([
          this.backgroundApi.simpleDb.prime.getAuthSessionCommitId(
            EPrimeAuthSessionSource.KeylessOAuth,
          ),
          readPersistedAccessTokenBySessionSourceStrict(
            EPrimeAuthSessionSource.KeylessOAuth,
          ),
        ]);
        if (sessionCommitId || slot.status !== 'empty') {
          return undefined;
        }
      }
    } else if (journal.target.clearKeylessSession && journal.keyless) {
      const [sessionCommitId, walletSessionCommitId, slot] = await Promise.all([
        this.backgroundApi.simpleDb.prime.getAuthSessionCommitId(
          EPrimeAuthSessionSource.KeylessOAuth,
        ),
        this.backgroundApi.simpleDb.prime.getKeylessSessionCommitId({
          walletId: journal.keyless.walletId,
        }),
        readPersistedAccessTokenBySessionSourceStrict(
          EPrimeAuthSessionSource.KeylessOAuth,
        ),
      ]);
      if (
        !wallet ||
        wallet.id !== journal.keyless.walletId ||
        wallet.keylessDetailsInfo?.keylessOwnerId !== journal.keyless.ownerId ||
        wallet.keylessDetailsInfo?.keylessProvider !==
          journal.keyless.provider ||
        wallet.keylessDetailsInfo?.socialUserIdHash !==
          journal.keyless.socialUserIdHash ||
        sessionCommitId ||
        walletSessionCommitId ||
        slot.status !== 'empty'
      ) {
        return undefined;
      }
    }
    return committedLifecycleRevision;
  }

  private async resumeIdentityExitJournalUnderLock(
    entry: IIdentityExitJournalEntry,
  ): Promise<IIdentityExitReceipt | undefined> {
    let journal = entry;
    const existingReceipt = this.buildReceiptFromCompletedJournal(journal);
    if (existingReceipt) {
      return existingReceipt;
    }

    beginIdentityExitReservation(journal.operationId);
    try {
      // A transport interruption cannot prove whether account deletion
      // reached the server. The explicit user intent still authorizes local
      // auth cleanup, but the completed journal retains an unknown outcome so
      // no caller can present it as confirmed server deletion.
      if (
        journal.status === 'serverDeletePrepared' ||
        journal.status === 'serverDeleteRejected'
      ) {
        const removed =
          await this.removeIdentityExitJournalEntryWithOutcomeCheck(journal);
        return removed ? { status: 'cancelled' } : undefined;
      }

      if (
        (journal.status === 'serverDeletePending' ||
          journal.status === 'serverDeleteOutcomeUnknown') &&
        !journal.serverDeleteOutcome
      ) {
        journal = { ...journal, serverDeleteOutcome: 'unknown' };
      } else if (
        journal.status === 'serverDeleted' &&
        !journal.serverDeleteOutcome
      ) {
        journal = { ...journal, serverDeleteOutcome: 'confirmed' };
      }

      if (journal.target.clearAllIdentityAuth) {
        if (
          journal.status === 'serverDeleted' ||
          journal.status === 'serverDeletePending' ||
          journal.status === 'serverDeleteOutcomeUnknown' ||
          journal.status === 'executing'
        ) {
          const localCommit =
            await this.backgroundApi.servicePrime.clearAllIdentityAuthForExplicitOperation(
              {
                callerName:
                  journal.intentType === 'appReset'
                    ? 'appReset'
                    : 'accountDeletion',
                expectedIdentityLifecycleRevision:
                  journal.expectedLifecycleRevision,
              },
            );
          if (localCommit.status !== 'committed' || !localCommit.revision) {
            return undefined;
          }
          journal = {
            ...journal,
            status: 'localStateCommitted',
            updatedAt: Date.now(),
            committedLifecycleRevision: localCommit.revision,
          };
          await this.persistIdentityExitJournalEntry(journal);
        }
        if (journal.status === 'localStateCommitted') {
          const committedLifecycleRevision =
            journal.committedLifecycleRevision ??
            journal.expectedLifecycleRevision + 1;
          return this.completeIdentityExitJournal({
            journal,
            committedLifecycleRevision,
          });
        }
        return undefined;
      }

      if (journal.status === 'executing' && journal.target.removeKeyless) {
        const wallet = await this.getKeylessWalletForJournalRecovery(journal);
        if (wallet?.id === journal.keyless?.walletId) {
          // The in-memory password capability never survives restart. A
          // present parent wallet means its destructive DB removal did not
          // start, so a fresh user-confirmed plan must authorize it again.
          const removed =
            await this.removeIdentityExitJournalEntryWithOutcomeCheck(journal);
          return removed ? { status: 'cancelled' } : undefined;
        }
        if (wallet) {
          return undefined;
        }
        journal = {
          ...journal,
          status: 'walletRemoved',
          updatedAt: Date.now(),
        };
        await this.persistIdentityExitJournalEntry(journal);
      }

      if (
        journal.status === 'executing' ||
        journal.status === 'walletRemoved'
      ) {
        if (journal.target.removeKeyless) {
          const wallet = await this.getKeylessWalletForJournalRecovery(journal);
          if (wallet) {
            return undefined;
          }
          await this.cleanupRemovedKeylessWalletCredentials(journal);
        }

        let committedLifecycleRevision =
          await this.isJournalLocalCommitApplied(journal);
        if (!committedLifecycleRevision) {
          const revision =
            await this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision();
          if (revision !== journal.expectedLifecycleRevision) {
            if (journal.intentType === 'remoteOneKeyIdLogout') {
              if (journal.remoteDeviceLogout) {
                return this.completeIdentityExitJournal({
                  journal,
                  committedLifecycleRevision: revision,
                  oneKeyIdLoggedOut: false,
                });
              }
              const removed =
                await this.removeIdentityExitJournalEntryWithOutcomeCheck(
                  journal,
                );
              return removed ? { status: 'cancelled' } : undefined;
            }
            return undefined;
          }
          const localCommit =
            await this.backgroundApi.servicePrime.commitIdentityExitLocalState({
              expectedIdentityLifecycleRevision:
                journal.expectedLifecycleRevision,
              oneKeyId:
                journal.target.logoutOneKeyId && journal.oneKeyId
                  ? journal.oneKeyId
                  : undefined,
              keylessSession:
                shouldClearKeylessSession(journal.target) &&
                (journal.keyless ||
                  journal.oneKeyId?.source ===
                    EPrimeAuthSessionSource.KeylessOAuth)
                  ? {
                      sessionCommitId:
                        journal.keyless?.sessionCommitId ??
                        journal.oneKeyId?.sessionCommitId,
                      sessionTokenSub:
                        journal.keyless?.sessionTokenSub ??
                        journal.oneKeyId?.sessionTokenSub,
                      allowUnknownIdentity:
                        journal.target.allowUnknownKeylessSessionIdentity,
                    }
                  : undefined,
              keylessWalletSession:
                (journal.target.removeKeyless ||
                  shouldClearKeylessSession(journal.target)) &&
                journal.keyless
                  ? {
                      walletId: journal.keyless.walletId,
                      sessionCommitId: getJournalWalletSessionCommitId(
                        journal.keyless,
                      ),
                    }
                  : undefined,
            });
          if (localCommit.status !== 'committed' || !localCommit.revision) {
            if (journal.intentType === 'remoteOneKeyIdLogout') {
              if (journal.remoteDeviceLogout) {
                const currentRevision =
                  await this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision();
                return this.completeIdentityExitJournal({
                  journal,
                  committedLifecycleRevision: currentRevision,
                  oneKeyIdLoggedOut: false,
                });
              }
              const removed =
                await this.removeIdentityExitJournalEntryWithOutcomeCheck(
                  journal,
                );
              return removed ? { status: 'cancelled' } : undefined;
            }
            return undefined;
          }
          committedLifecycleRevision = localCommit.revision;
        }
        journal = {
          ...journal,
          status: 'localStateCommitted',
          updatedAt: Date.now(),
          committedLifecycleRevision,
        };
        await this.persistIdentityExitJournalEntry(journal);
      }

      if (journal.status === 'localStateCommitted') {
        const committedLifecycleRevision =
          journal.committedLifecycleRevision ??
          journal.expectedLifecycleRevision + 1;
        const receipt = await this.completeIdentityExitJournal({
          journal,
          committedLifecycleRevision,
        });
        await this.finalizeRemovedKeylessWalletSideEffectsBestEffort(journal);
        return receipt;
      }
      return undefined;
    } finally {
      endIdentityExitReservation(journal.operationId);
    }
  }

  @backgroundMethod()
  async recoverInterruptedIdentityExitOperations(): Promise<{
    recoveredOperationCount: number;
    abandonedOperationCount: number;
  }> {
    this.assertIdentityExitJournalStorageOutcomeKnown();
    await this.backgroundApi.servicePrime.recoverInterruptedKeylessOAuthSessionPersistence();
    return identityLifecycleMutex.runExclusiveForRecovery(async () => {
      markIdentityRecoveryPending(IDENTITY_EXIT_RECOVERY_SWEEP_OPERATION_ID);
      try {
        const entries = Object.values(
          await this.backgroundApi.simpleDb.prime.getIdentityExitOperationJournal(),
        ).toSorted((a, b) => a.startedAt - b.startedAt);
        let recoveredOperationCount = 0;
        let abandonedOperationCount = 0;
        for (const entry of entries) {
          markIdentityRecoveryPending(entry.operationId);
          if (entry.status === 'completed') {
            const receipt = this.buildReceiptFromCompletedJournal(entry);
            if (receipt?.status === 'completed') {
              await this.markRemoteDeviceLogoutNoopPresentationHandled({
                journal: entry,
                receipt,
              });
              storeSettledIdentityExitReceipt({
                operationId: entry.operationId,
                planId: entry.planId,
                receipt,
                expiresAt: receipt.startIndependentOneKeyIdOAuth?.expiresAt,
              });
            }
            await this.retainLiveOAuthHandoffOrRemoveCompletedJournal(entry);
            markIdentityRecoveryReady(entry.operationId);
          } else {
            const receipt =
              await this.resumeIdentityExitJournalUnderLock(entry);
            if (receipt?.status === 'completed') {
              await this.markRemoteDeviceLogoutNoopPresentationHandled({
                journal: entry,
                receipt,
              });
              recoveredOperationCount += 1;
              markIdentityRecoveryReady(entry.operationId);
            } else if (receipt?.status === 'cancelled') {
              abandonedOperationCount += 1;
              markIdentityRecoveryReady(entry.operationId);
            } else if (!receipt) {
              markIdentityRecoveryFailed(entry.operationId);
              throw new OneKeyLocalError(
                'An interrupted identity operation could not be recovered safely.',
              );
            }
          }
        }
        markIdentityRecoveryReady(IDENTITY_EXIT_RECOVERY_SWEEP_OPERATION_ID);
        markIdentityRecoveryReady();
        return { recoveredOperationCount, abandonedOperationCount };
      } catch (error) {
        markIdentityRecoveryFailed(IDENTITY_EXIT_RECOVERY_SWEEP_OPERATION_ID);
        throw error;
      }
    });
  }

  private buildRemoteOneKeyIdLogoutJournal({
    snapshot,
    operationId,
  }: {
    snapshot: IIdentityExitSnapshot;
    operationId: string;
  }): IIdentityExitJournalEntry {
    if (snapshot.oneKeyId.type !== 'loggedIn') {
      throw new OneKeyLocalError(
        'Cannot build a remote OneKey ID logout journal while logged out.',
      );
    }
    const timestamp = Date.now();
    const clearsKeylessSession =
      snapshot.oneKeyId.source === EPrimeAuthSessionSource.KeylessOAuth &&
      (snapshot.keyless.type === 'absent' ||
        getIdentityLinkage(snapshot) === 'linked');
    return {
      operationId,
      planId: `system:${operationId}`,
      intentType: 'remoteOneKeyIdLogout',
      status: 'executing',
      startedAt: timestamp,
      updatedAt: timestamp,
      expectedLifecycleRevision: snapshot.lifecycleRevision,
      target: {
        logoutOneKeyId: true,
        removeKeyless: false,
        clearKeylessSession: clearsKeylessSession,
      },
      oneKeyId: {
        onekeyUserId: snapshot.oneKeyId.onekeyUserId,
        source: snapshot.oneKeyId.source,
        sessionCommitId: snapshot.oneKeyId.sessionCommitId,
        sessionTokenSub: snapshot.oneKeyId.sessionTokenSub,
      },
      keyless:
        snapshot.keyless.type === 'present'
          ? {
              walletId: snapshot.keyless.walletId,
              ownerId: snapshot.keyless.ownerId,
              provider: snapshot.keyless.provider,
              socialUserIdHash: snapshot.keyless.socialUserIdHash,
              sessionCommitId: snapshot.keyless.sessionCommitId,
              sessionTokenSub: snapshot.keyless.sessionTokenSub,
              walletSessionCommitId:
                snapshot.keyless.walletSessionCommitId ?? null,
            }
          : undefined,
    };
  }

  private buildRemoteDeviceLogoutStageResult(
    journal: IIdentityExitJournalEntry,
    messageId: string,
  ): {
    operationId: string;
    planId: IIdentityExitPlanId;
    acknowledged: boolean;
    presentationHandled: boolean;
  } {
    if (
      journal.intentType !== 'remoteOneKeyIdLogout' ||
      journal.remoteDeviceLogout?.messageId !== messageId
    ) {
      throw new OneKeyLocalError(
        'Remote device logout message collided with another identity operation.',
      );
    }
    return {
      operationId: journal.operationId,
      planId: journal.planId as IIdentityExitPlanId,
      acknowledged: Boolean(journal.remoteDeviceLogout.acknowledgedAt),
      presentationHandled: Boolean(
        journal.remoteDeviceLogout.presentationHandledAt,
      ),
    };
  }

  @backgroundMethod()
  async stageRemoteOneKeyIdLogoutNotification({
    messageId,
  }: {
    messageId: string;
  }): Promise<{
    operationId: string;
    planId: IIdentityExitPlanId;
    acknowledged: boolean;
    presentationHandled: boolean;
  }> {
    if (!messageId) {
      throw new OneKeyLocalError(
        'Remote device logout message ID is unavailable.',
      );
    }
    this.assertIdentityExitJournalStorageOutcomeKnown();
    await this.recoverInterruptedIdentityExitOperations();
    this.assertIdentityExitJournalStorageOutcomeKnown();
    const operationId = `remoteDeviceLogout:${messageId}`;
    return identityLifecycleMutex.runExclusive(async () => {
      this.assertIdentityExitJournalStorageOutcomeKnown();
      const existing = (
        await this.backgroundApi.simpleDb.prime.getIdentityExitOperationJournal()
      )[operationId];
      if (existing) {
        if (existing.status === 'completed') {
          const receipt = this.buildReceiptFromCompletedJournal(existing);
          if (receipt?.status === 'completed') {
            storeSettledIdentityExitReceipt({
              operationId,
              planId: existing.planId,
              receipt,
            });
          }
        } else {
          markIdentityRecoveryPending(operationId);
        }
        return this.buildRemoteDeviceLogoutStageResult(existing, messageId);
      }

      const snapshot = await this.readAuthoritativeSnapshot();
      const timestamp = Date.now();
      const baseJournal =
        snapshot.oneKeyId.type === 'loggedIn'
          ? this.buildRemoteOneKeyIdLogoutJournal({
              snapshot,
              operationId,
            })
          : ({
              operationId,
              planId: `system:${operationId}`,
              intentType: 'remoteOneKeyIdLogout',
              status: 'completed',
              startedAt: timestamp,
              updatedAt: timestamp,
              expectedLifecycleRevision: snapshot.lifecycleRevision,
              committedLifecycleRevision: snapshot.lifecycleRevision,
              target: {
                logoutOneKeyId: false,
                removeKeyless: false,
                clearKeylessSession: false,
              },
              completed: {
                oneKeyIdLoggedOut: false,
              },
            } satisfies IIdentityExitJournalEntry);
      const journal: IIdentityExitJournalEntry = {
        ...baseJournal,
        remoteDeviceLogout: {
          messageId,
          presentationHandledAt:
            baseJournal.status === 'completed' &&
            !baseJournal.completed?.oneKeyIdLoggedOut
              ? timestamp
              : undefined,
        },
      };
      markIdentityRecoveryPending(operationId);
      let ensured: {
        created: boolean;
        entry: IIdentityExitJournalEntry;
      };
      try {
        ensured =
          await this.backgroundApi.simpleDb.prime.ensureIdentityExitJournalEntry(
            journal,
          );
      } catch (error) {
        this.markIdentityExitJournalStorageOutcomeUnknown(operationId);
        throw error;
      }
      if (ensured.created) {
        settledReceiptRegistry.delete(ensured.entry.planId);
      }
      if (ensured.entry.status === 'completed') {
        const receipt = this.buildReceiptFromCompletedJournal(ensured.entry);
        if (!receipt || receipt.status !== 'completed') {
          this.markIdentityExitJournalStorageOutcomeUnknown(operationId);
          throw new OneKeyLocalError(
            'Remote device logout completion record is invalid.',
          );
        }
        storeSettledIdentityExitReceipt({
          operationId,
          planId: ensured.entry.planId,
          receipt,
        });
      }
      return this.buildRemoteDeviceLogoutStageResult(ensured.entry, messageId);
    });
  }

  @backgroundMethod()
  async getPendingRemoteOneKeyIdLogoutNotifications(): Promise<
    {
      operationId: string;
      planId: IIdentityExitPlanId;
      messageId: string;
      needsAcknowledgement: boolean;
      needsPresentation: boolean;
    }[]
  > {
    return identityLifecycleMutex.runExclusiveForRecovery(async () => {
      this.assertIdentityExitJournalStorageOutcomeKnown();
      const journal =
        await this.backgroundApi.simpleDb.prime.getIdentityExitOperationJournal();
      this.assertIdentityExitJournalStorageOutcomeKnown();
      return Object.values(journal)
        .filter((entry) => {
          const delivery = entry.remoteDeviceLogout;
          return Boolean(
            delivery &&
            (!delivery.acknowledgedAt || !delivery.presentationHandledAt),
          );
        })
        .toSorted((a, b) => a.startedAt - b.startedAt)
        .map((entry) => ({
          operationId: entry.operationId,
          planId: entry.planId as IIdentityExitPlanId,
          messageId: entry.remoteDeviceLogout?.messageId || '',
          needsAcknowledgement: !entry.remoteDeviceLogout?.acknowledgedAt,
          needsPresentation: !entry.remoteDeviceLogout?.presentationHandledAt,
        }));
    });
  }

  @backgroundMethod()
  async getPendingRemoteOneKeyIdLogoutPresentations(): Promise<
    {
      operationId: string;
      messageId: string;
    }[]
  > {
    await this.recoverInterruptedIdentityExitOperations();
    return identityLifecycleMutex.runExclusive(async () => {
      this.assertIdentityExitJournalStorageOutcomeKnown();
      const journal =
        await this.backgroundApi.simpleDb.prime.getIdentityExitOperationJournal();
      this.assertIdentityExitJournalStorageOutcomeKnown();
      return Object.values(journal)
        .filter(
          (entry) =>
            entry.status === 'completed' &&
            entry.completed?.oneKeyIdLoggedOut &&
            entry.remoteDeviceLogout &&
            !entry.remoteDeviceLogout.presentationHandledAt,
        )
        .toSorted((a, b) => a.startedAt - b.startedAt)
        .map((entry) => ({
          operationId: entry.operationId,
          messageId: entry.remoteDeviceLogout?.messageId || '',
        }));
    });
  }

  @backgroundMethod()
  async tryClaimRemoteOneKeyIdLogoutPresentation({
    operationId,
    messageId,
  }: {
    operationId: string;
    messageId: string;
  }): Promise<IRemoteOneKeyIdLogoutPresentationClaimResult> {
    const now = Date.now();
    const claimId = stringUtils.generateUUID();
    return this.backgroundApi.simpleDb.prime.tryClaimRemoteOneKeyIdLogoutPresentation(
      {
        operationId,
        messageId,
        claimId,
        expiresAt: now + REMOTE_DEVICE_LOGOUT_PRESENTATION_LEASE_TTL_MS,
        now,
      },
    );
  }

  @backgroundMethod()
  async completeRemoteOneKeyIdLogoutPresentation({
    operationId,
    messageId,
    claimId,
  }: {
    operationId: string;
    messageId: string;
    claimId: string;
  }): Promise<{ updated: boolean }> {
    const timestamp = Date.now();
    let entry: IIdentityExitJournalEntry | undefined;
    try {
      entry =
        await this.backgroundApi.simpleDb.prime.completeRemoteOneKeyIdLogoutPresentation(
          {
            operationId,
            messageId,
            claimId,
            presentationHandledAt: timestamp,
            tombstoneExpiresAt:
              timestamp + REMOTE_DEVICE_LOGOUT_TOMBSTONE_TTL_MS,
          },
        );
    } catch (error) {
      try {
        const current = (
          await this.backgroundApi.simpleDb.prime.getIdentityExitOperationJournal()
        )[operationId];
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
    if (!entry) {
      return { updated: false };
    }
    this.scheduleRemoteDeviceLogoutJournalExpiryCleanup(entry);
    return { updated: true };
  }

  @backgroundMethod()
  async markRemoteOneKeyIdLogoutNotificationDelivered({
    operationId,
    messageId,
    delivery,
  }: {
    operationId: string;
    messageId: string;
    delivery: 'acknowledged' | 'presentationHandled';
  }): Promise<{ updated: boolean }> {
    const timestamp = Date.now();
    const entry =
      await this.backgroundApi.simpleDb.prime.updateRemoteOneKeyIdLogoutJournalDelivery(
        {
          operationId,
          messageId,
          acknowledgedAt: delivery === 'acknowledged' ? timestamp : undefined,
          presentationHandledAt:
            delivery === 'presentationHandled' ? timestamp : undefined,
          tombstoneExpiresAt: timestamp + REMOTE_DEVICE_LOGOUT_TOMBSTONE_TTL_MS,
        },
      );
    if (!entry) {
      return { updated: false };
    }
    if (entry.status === 'completed') {
      this.scheduleRemoteDeviceLogoutJournalExpiryCleanup(entry);
    }
    return { updated: true };
  }

  @backgroundMethod()
  async stageRemoteOneKeyIdLogoutReconciliation({
    expectedAccessToken,
  }: {
    expectedAccessToken: string;
  }): Promise<
    | { staged: false }
    | {
        staged: true;
        operationId: string;
        planId: IIdentityExitPlanId;
      }
  > {
    if (!expectedAccessToken) {
      return { staged: false };
    }
    const snapshot = await this.readAuthoritativeSnapshot();
    if (
      snapshot.oneKeyId.type === 'loggedOut' ||
      snapshot.oneKeyId.accessToken !== expectedAccessToken
    ) {
      return { staged: false };
    }
    const operationId = `invalidToken:${snapshot.oneKeyId.source}:${snapshot.oneKeyId.sessionCommitId}`;
    const journal = this.buildRemoteOneKeyIdLogoutJournal({
      snapshot,
      operationId,
    });
    markIdentityRecoveryPending(operationId);
    try {
      await this.persistIdentityExitJournalEntry(journal);
    } catch (error) {
      markIdentityRecoveryFailed(operationId);
      throw error;
    }
    return {
      staged: true,
      operationId,
      planId: journal.planId as IIdentityExitPlanId,
    };
  }

  /**
   * Durable repair for a logged-in OneKey ID whose active session slot is
   * definitively empty. This is BG-internal: UI/profile effects may observe
   * the projection, but they cannot directly clear auth metadata or atoms.
   */
  async reconcileMissingOneKeyIdSession({
    callerName,
  }: {
    callerName: string;
  }): Promise<{ cleared: boolean }> {
    await this.recoverInterruptedIdentityExitOperations();
    return identityLifecycleMutex.runExclusive(async () => {
      const operationId = `missingOneKeyIdSession:${stringUtils.generateUUID()}`;
      beginIdentityExitReservation(operationId);
      let didStartRecoveryBarrier = false;
      try {
        const [
          lifecycleRevision,
          source,
          oneKeyIdAuthState,
          primeUser,
          wallet,
        ] = await Promise.all([
          this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision(),
          this.backgroundApi.simpleDb.prime.getAuthSessionSource(),
          this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
          primePersistAtom.get(),
          this.backgroundApi.serviceAccount.getKeylessWallet(),
        ]);
        const isLoggedIn = Boolean(
          primeUser.isLoggedIn && primeUser.isLoggedInOnServer,
        );
        if (!isLoggedIn && oneKeyIdAuthState === 'loggedOut' && !source) {
          return { cleared: false };
        }
        if (
          primeUser.isLoggedIn !== primeUser.isLoggedInOnServer ||
          !isLoggedIn ||
          oneKeyIdAuthState !== 'loggedIn' ||
          !source ||
          !primeUser.onekeyUserId
        ) {
          throw new OneKeyLocalError(
            `${callerName}: OneKey ID projection is inconsistent while reconciling an empty session slot.`,
          );
        }
        const slot =
          await readPersistedAccessTokenBySessionSourceStrict(source);
        if (slot.status === 'ok') {
          return { cleared: false };
        }
        if (slot.status !== 'empty') {
          throw new OneKeyLocalError(
            `${callerName}: OneKey ID session slot is ${slot.status}; automatic reconciliation is unsafe.`,
          );
        }
        const sessionCommitId =
          await this.backgroundApi.simpleDb.prime.getAuthSessionCommitId(
            source,
          );
        if (!sessionCommitId) {
          throw new OneKeyLocalError(
            `${callerName}: OneKey ID session commit identity is unavailable.`,
          );
        }

        let keyless: IIdentityExitJournalEntry['keyless'];
        if (source === EPrimeAuthSessionSource.KeylessOAuth && wallet) {
          const ownerId = wallet.keylessDetailsInfo?.keylessOwnerId;
          const provider = wallet.keylessDetailsInfo?.keylessProvider;
          const socialUserIdHash = wallet.keylessDetailsInfo?.socialUserIdHash;
          if (!ownerId || !provider || !socialUserIdHash) {
            throw new OneKeyLocalError(
              `${callerName}: Keyless wallet identity fields are unavailable.`,
            );
          }
          const walletSessionCommitId =
            await this.backgroundApi.simpleDb.prime.getKeylessSessionCommitId({
              walletId: wallet.id,
            });
          if (
            walletSessionCommitId &&
            walletSessionCommitId !== sessionCommitId
          ) {
            throw new OneKeyLocalError(
              `${callerName}: Keyless wallet and session commit identities are inconsistent.`,
            );
          }
          keyless = {
            walletId: wallet.id,
            ownerId,
            provider,
            socialUserIdHash,
            sessionCommitId,
            walletSessionCommitId: walletSessionCommitId ?? null,
          };
        }

        let journal: IIdentityExitJournalEntry = {
          operationId,
          planId: operationId,
          intentType: 'missingOneKeyIdSessionReconciliation',
          status: 'executing',
          startedAt: Date.now(),
          updatedAt: Date.now(),
          expectedLifecycleRevision: lifecycleRevision,
          target: {
            logoutOneKeyId: true,
            removeKeyless: false,
            clearKeylessSession:
              source === EPrimeAuthSessionSource.KeylessOAuth,
          },
          oneKeyId: {
            onekeyUserId: primeUser.onekeyUserId,
            source,
            sessionCommitId,
          },
          keyless,
        };
        markIdentityRecoveryPending(operationId);
        didStartRecoveryBarrier = true;
        await this.persistIdentityExitJournalEntry(journal);
        const localCommit =
          await this.backgroundApi.servicePrime.commitIdentityExitLocalState({
            expectedIdentityLifecycleRevision: lifecycleRevision,
            oneKeyId: journal.oneKeyId,
            keylessSession:
              source === EPrimeAuthSessionSource.KeylessOAuth
                ? { sessionCommitId }
                : undefined,
            keylessWalletSession: keyless
              ? {
                  walletId: keyless.walletId,
                  sessionCommitId: getJournalWalletSessionCommitId(keyless),
                }
              : undefined,
          });
        if (localCommit.status !== 'committed' || !localCommit.revision) {
          throw new OneKeyLocalError(
            `${callerName}: Identity state changed during empty-session reconciliation.`,
          );
        }
        journal = {
          ...journal,
          status: 'localStateCommitted',
          updatedAt: Date.now(),
          committedLifecycleRevision: localCommit.revision,
        };
        await this.persistIdentityExitJournalEntry(journal);
        await this.completeIdentityExitJournal({
          journal,
          committedLifecycleRevision: localCommit.revision,
        });
        markIdentityRecoveryReady(operationId);
        return { cleared: true };
      } catch (error) {
        if (didStartRecoveryBarrier) {
          markIdentityRecoveryFailed(operationId);
        }
        throw error;
      } finally {
        endIdentityExitReservation(operationId);
      }
    });
  }

  @backgroundMethod()
  async reconcileRemoteOneKeyIdLogout({
    expectedAccessToken,
  }: {
    expectedAccessToken?: string;
  } = {}): Promise<IIdentityExitReceipt> {
    await this.recoverInterruptedIdentityExitOperations();
    return identityLifecycleMutex.runExclusive(async () => {
      const snapshot = await this.readAuthoritativeSnapshot();
      if (snapshot.oneKeyId.type === 'loggedOut') {
        return { status: 'completed', oneKeyIdLoggedOut: false };
      }
      if (
        expectedAccessToken &&
        snapshot.oneKeyId.accessToken !== expectedAccessToken
      ) {
        return {
          status: 'blocked',
          code: 'STATE_CHANGED',
          message:
            'The invalid-token response no longer matches the active OneKey ID session.',
        };
      }

      const operationId = stringUtils.generateUUID();
      beginIdentityExitReservation(operationId);
      let didStartRecoveryBarrier = false;
      try {
        let journal = this.buildRemoteOneKeyIdLogoutJournal({
          snapshot,
          operationId,
        });
        const clearsKeylessSession = shouldClearKeylessSession(journal.target);
        markIdentityRecoveryPending(operationId);
        didStartRecoveryBarrier = true;
        await this.persistIdentityExitJournalEntry(journal);

        const localCommit =
          await this.backgroundApi.servicePrime.commitIdentityExitLocalState({
            expectedIdentityLifecycleRevision: snapshot.lifecycleRevision,
            oneKeyId: journal.oneKeyId,
            keylessSession: clearsKeylessSession
              ? {
                  sessionCommitId:
                    journal.keyless?.sessionCommitId ??
                    journal.oneKeyId?.sessionCommitId,
                  sessionTokenSub:
                    journal.keyless?.sessionTokenSub ??
                    journal.oneKeyId?.sessionTokenSub,
                }
              : undefined,
            keylessWalletSession:
              clearsKeylessSession && journal.keyless
                ? {
                    walletId: journal.keyless.walletId,
                    sessionCommitId: getJournalWalletSessionCommitId(
                      journal.keyless,
                    ),
                  }
                : undefined,
          });
        if (localCommit.status !== 'committed' || !localCommit.revision) {
          throw new OneKeyLocalError(
            'Identity state changed during remote logout reconciliation.',
          );
        }
        journal = {
          ...journal,
          status: 'localStateCommitted',
          updatedAt: Date.now(),
          committedLifecycleRevision: localCommit.revision,
        };
        await this.persistIdentityExitJournalEntry(journal);
        const receipt = await this.completeIdentityExitJournal({
          journal,
          committedLifecycleRevision: localCommit.revision,
        });
        markIdentityRecoveryReady(operationId);
        return receipt;
      } catch (error) {
        if (didStartRecoveryBarrier) {
          markIdentityRecoveryFailed(operationId);
        }
        throw error;
      } finally {
        endIdentityExitReservation(operationId);
      }
    });
  }

  @backgroundMethod()
  async reconcileInvalidKeylessSessionForLocalWallet(): Promise<{
    cleared: boolean;
  }> {
    await this.recoverInterruptedIdentityExitOperations();
    return identityLifecycleMutex.runExclusive(async () => {
      const operationId = `invalidKeylessSession:${stringUtils.generateUUID()}`;
      beginIdentityExitReservation(operationId);
      let didStartRecoveryBarrier = false;
      try {
        const wallet =
          await this.backgroundApi.serviceAccount.getKeylessWallet();
        if (!wallet) {
          return { cleared: false };
        }
        const slot = await readPersistedAccessTokenBySessionSourceStrict(
          EPrimeAuthSessionSource.KeylessOAuth,
        );
        if (slot.status === 'empty') {
          return { cleared: false };
        }
        if (slot.status !== 'ok') {
          throw new OneKeyLocalError(
            `Keyless OAuth session slot is ${slot.status}; exact reconciliation is unavailable.`,
          );
        }
        const validation =
          await this.backgroundApi.serviceKeylessWallet.validateTokenMatchesKeylessWallet(
            {
              token: slot.accessToken,
              skipFixProvider: true,
            },
          );
        if (validation.isValid) {
          return { cleared: false };
        }

        const [
          lifecycleRevision,
          persistedSessionCommitId,
          walletSessionCommitId,
          source,
          oneKeyIdAuthState,
          primeUser,
        ] = await Promise.all([
          this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision(),
          this.backgroundApi.simpleDb.prime.getAuthSessionCommitId(
            EPrimeAuthSessionSource.KeylessOAuth,
          ),
          this.backgroundApi.simpleDb.prime.getKeylessSessionCommitId({
            walletId: wallet.id,
          }),
          this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource(),
          this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
          primePersistAtom.get(),
        ]);
        if (primeUser.isLoggedIn !== primeUser.isLoggedInOnServer) {
          throw new OneKeyLocalError(
            'OneKey ID local and server login projections are inconsistent during Keyless session reconciliation.',
          );
        }
        const isOneKeyIdLoggedIn = Boolean(
          primeUser.isLoggedIn && primeUser.isLoggedInOnServer,
        );
        if (
          (isOneKeyIdLoggedIn &&
            (!source || oneKeyIdAuthState === 'loggedOut')) ||
          (!isOneKeyIdLoggedIn &&
            (source !== undefined || oneKeyIdAuthState === 'loggedIn'))
        ) {
          throw new OneKeyLocalError(
            'OneKey ID auth source is unavailable or inconsistent during Keyless session reconciliation.',
          );
        }
        if (
          persistedSessionCommitId &&
          walletSessionCommitId &&
          persistedSessionCommitId !== walletSessionCommitId
        ) {
          throw new OneKeyLocalError(
            'Keyless OAuth session commit identities are inconsistent during reconciliation.',
          );
        }
        let sessionCommitId = persistedSessionCommitId;
        sessionCommitId ??=
          await this.backgroundApi.simpleDb.prime.backfillAuthSessionCommitIdForMigration(
            {
              authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
              expectedActiveAuthSessionSource: source,
              preferredSessionCommitId: walletSessionCommitId,
            },
          );
        if (!sessionCommitId) {
          throw new OneKeyLocalError(
            'Keyless OAuth session commit identity is unavailable.',
          );
        }
        const sessionTokenSub = decodeSessionTokenSub(
          slot.accessToken,
          'Keyless OAuth',
        );
        const shouldLogoutOneKeyId =
          isOneKeyIdLoggedIn && source === EPrimeAuthSessionSource.KeylessOAuth;
        const onekeyUserId = primeUser.onekeyUserId;
        if (shouldLogoutOneKeyId && !onekeyUserId) {
          throw new OneKeyLocalError(
            'OneKey ID onekeyUserId is unavailable during Keyless session reconciliation.',
          );
        }
        const reconciledOneKeyId: IIdentityExitJournalEntry['oneKeyId'] =
          shouldLogoutOneKeyId && onekeyUserId
            ? {
                onekeyUserId,
                source: EPrimeAuthSessionSource.KeylessOAuth,
                sessionCommitId,
                sessionTokenSub,
              }
            : undefined;
        const ownerId = wallet.keylessDetailsInfo?.keylessOwnerId;
        const provider = wallet.keylessDetailsInfo?.keylessProvider;
        const socialUserIdHash = wallet.keylessDetailsInfo?.socialUserIdHash;
        if (!ownerId || !provider || !socialUserIdHash) {
          throw new OneKeyLocalError(
            'Keyless wallet identity fields are unavailable during session reconciliation.',
          );
        }
        let journal: IIdentityExitJournalEntry = {
          operationId,
          planId: operationId,
          intentType: 'invalidKeylessSessionReconciliation',
          status: 'executing',
          startedAt: Date.now(),
          updatedAt: Date.now(),
          expectedLifecycleRevision: lifecycleRevision,
          target: {
            logoutOneKeyId: shouldLogoutOneKeyId,
            removeKeyless: false,
            clearKeylessSession: true,
          },
          oneKeyId: reconciledOneKeyId,
          keyless: {
            walletId: wallet.id,
            ownerId,
            provider,
            socialUserIdHash,
            sessionCommitId,
            sessionTokenSub,
            walletSessionCommitId: walletSessionCommitId ?? null,
          },
        };
        markIdentityRecoveryPending(operationId);
        didStartRecoveryBarrier = true;
        await this.persistIdentityExitJournalEntry(journal);
        const result =
          await this.backgroundApi.servicePrime.commitIdentityExitLocalState({
            expectedIdentityLifecycleRevision: lifecycleRevision,
            oneKeyId: reconciledOneKeyId,
            keylessSession: { sessionCommitId, sessionTokenSub },
            keylessWalletSession: {
              walletId: wallet.id,
              sessionCommitId: walletSessionCommitId,
            },
          });
        if (result.status !== 'committed') {
          throw new OneKeyLocalError(
            'Identity state changed during Keyless session reconciliation.',
          );
        }
        if (!result.revision) {
          throw new OneKeyLocalError(
            'Keyless session reconciliation committed without a lifecycle revision.',
          );
        }
        journal = {
          ...journal,
          status: 'localStateCommitted',
          updatedAt: Date.now(),
          committedLifecycleRevision: result.revision,
        };
        await this.persistIdentityExitJournalEntry(journal);
        await this.completeIdentityExitJournal({
          journal,
          committedLifecycleRevision: result.revision,
        });
        markIdentityRecoveryReady(operationId);
        return { cleared: true };
      } catch (error) {
        if (didStartRecoveryBarrier) {
          markIdentityRecoveryFailed(operationId);
        }
        throw error;
      } finally {
        endIdentityExitReservation(operationId);
      }
    });
  }

  private async runMalformedKeylessRecovery(
    storedPlan: IStoredMalformedKeylessRecoveryPlan,
  ): Promise<IIdentityExitReceipt> {
    const walletId = storedPlan.snapshot.keyless.fingerprint.walletId;
    try {
      await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
        walletId,
        reason: EReasonForNeedPassword.Security,
      });
    } catch (error) {
      if (errorToastUtils.isUserCancelStyleError(error)) {
        return { status: 'cancelled' };
      }
      throw error;
    }

    return identityLifecycleMutex.runExclusive(async () => {
      beginIdentityExitReservation(storedPlan.operationId);
      try {
        const snapshot = await this.readMalformedKeylessRecoverySnapshot();
        const comparableSnapshot = {
          ...snapshot,
          oneKeyId:
            snapshot.oneKeyId.type === 'loggedIn'
              ? { ...snapshot.oneKeyId, accessToken: undefined }
              : snapshot.oneKeyId,
        };
        const comparableStoredSnapshot = {
          ...storedPlan.snapshot,
          oneKeyId:
            storedPlan.snapshot.oneKeyId.type === 'loggedIn'
              ? {
                  ...storedPlan.snapshot.oneKeyId,
                  accessToken: undefined,
                }
              : storedPlan.snapshot.oneKeyId,
        };
        if (!isEqual(comparableSnapshot, comparableStoredSnapshot)) {
          return {
            status: 'blocked',
            code: 'STATE_CHANGED',
            // TODO: i18n
            message: 'Identity state changed. Please reopen and try again.',
          };
        }

        let journal = this.buildMalformedKeylessRecoveryJournal({
          storedPlan,
          snapshot,
        });
        markIdentityRecoveryPending(storedPlan.operationId);
        await this.persistIdentityExitJournalEntry(journal);

        const expectedFingerprint = snapshot.keyless.fingerprint;
        const capability = createMalformedKeylessWalletRemovalCapability({
          expectedFingerprint,
          operationId: storedPlan.operationId,
          lifecycleRevision: snapshot.lifecycleRevision,
        });
        await this.backgroundApi.serviceAccount.removeMalformedKeylessWalletWithCapability(
          {
            capability,
            expectedFingerprint,
            operationId: storedPlan.operationId,
            lifecycleRevision: snapshot.lifecycleRevision,
          },
        );
        journal = {
          ...journal,
          status: 'walletRemoved',
          updatedAt: Date.now(),
        };
        await this.persistIdentityExitJournalEntry(journal);

        if (
          storedPlan.target.logoutOneKeyId &&
          snapshot.oneKeyId.type === 'loggedIn' &&
          snapshot.oneKeyId.accessToken
        ) {
          await Promise.all([
            this.backgroundApi.servicePrime.logoutPrimeServerSessionBestEffort({
              accessToken: snapshot.oneKeyId.accessToken,
              callerName: 'ServiceIdentityExit.runMalformedKeylessRecovery',
            }),
            revokeAuthSessionTokenOnServerBestEffort({
              authSessionSource: snapshot.oneKeyId.source,
              accessToken: snapshot.oneKeyId.accessToken,
            }),
          ]);
        }

        await this.cleanupRemovedKeylessWalletCredentials(journal);
        const localCommit =
          await this.backgroundApi.servicePrime.commitIdentityExitLocalState({
            expectedIdentityLifecycleRevision: snapshot.lifecycleRevision,
            oneKeyId:
              storedPlan.target.logoutOneKeyId &&
              snapshot.oneKeyId.type === 'loggedIn'
                ? {
                    onekeyUserId: snapshot.oneKeyId.onekeyUserId,
                    source: snapshot.oneKeyId.source,
                    sessionCommitId: snapshot.oneKeyId.sessionCommitId,
                    sessionTokenSub:
                      snapshot.oneKeyId.sessionTokenSub || undefined,
                  }
                : undefined,
            keylessSession: {
              sessionCommitId: snapshot.keyless.sessionCommitId,
              sessionTokenSub: snapshot.keyless.sessionTokenSub,
              allowUnknownIdentity: true,
            },
            keylessWalletSession: {
              walletId,
              sessionCommitId: snapshot.keyless.walletSessionCommitId,
            },
          });
        if (localCommit.status !== 'committed' || !localCommit.revision) {
          throw new OneKeyLocalError(
            'Identity state changed after the malformed Keyless wallet was removed. Recovery is required.',
          );
        }
        journal = {
          ...journal,
          status: 'localStateCommitted',
          updatedAt: Date.now(),
          committedLifecycleRevision: localCommit.revision,
        };
        await this.persistIdentityExitJournalEntry(journal);
        const receipt = await this.completeIdentityExitJournal({
          journal,
          committedLifecycleRevision: localCommit.revision,
        });
        await this.finalizeRemovedKeylessWalletSideEffectsBestEffort(journal);
        markIdentityRecoveryReady(storedPlan.operationId);
        return receipt;
      } finally {
        endIdentityExitReservation(storedPlan.operationId);
      }
    });
  }

  private async runIdentityExit(
    storedPlan: IStoredIdentityExitPlan,
  ): Promise<IIdentityExitReceipt> {
    if (storedPlan.kind === 'malformedKeylessRecovery') {
      return this.runMalformedKeylessRecovery(storedPlan);
    }
    if (storedPlan.target.removeKeyless) {
      const walletId =
        storedPlan.snapshot.keyless.type === 'present'
          ? storedPlan.snapshot.keyless.walletId
          : '';
      try {
        await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
          walletId,
          reason: EReasonForNeedPassword.Security,
        });
      } catch (error) {
        if (errorToastUtils.isUserCancelStyleError(error)) {
          return { status: 'cancelled' };
        }
        throw error;
      }
    }

    return identityLifecycleMutex.runExclusive(async () => {
      beginIdentityExitReservation(storedPlan.operationId);
      try {
        const snapshot = await this.readAuthoritativeSnapshot();
        if (
          !isEqual(
            getComparableSnapshot(snapshot),
            getComparableSnapshot(storedPlan.snapshot),
          )
        ) {
          return {
            status: 'blocked',
            code: 'STATE_CHANGED',
            // TODO: i18n
            message: 'Identity state changed. Please reopen and try again.',
          };
        }

        let journal = this.buildJournalEntry({ storedPlan, snapshot });
        markIdentityRecoveryPending(storedPlan.operationId);
        await this.persistIdentityExitJournalEntry(journal);

        if (storedPlan.target.removeKeyless) {
          if (snapshot.keyless.type !== 'present') {
            return {
              status: 'blocked',
              code: 'STATE_CHANGED',
              // TODO: i18n
              message: 'The expected Keyless wallet is no longer available.',
            };
          }
          const expectedIdentity: IKeylessWalletRemovalIdentity = {
            walletId: snapshot.keyless.walletId,
            keylessOwnerId: snapshot.keyless.ownerId,
            keylessProvider: snapshot.keyless.provider,
            socialUserIdHash: snapshot.keyless.socialUserIdHash,
          };
          const capability = createKeylessWalletRemovalCapability({
            expectedIdentity,
            operationId: storedPlan.operationId,
            lifecycleRevision: snapshot.lifecycleRevision,
          });
          await this.backgroundApi.serviceAccount.removeKeylessWalletWithCapability(
            {
              capability,
              expectedIdentity,
              operationId: storedPlan.operationId,
              lifecycleRevision: snapshot.lifecycleRevision,
            },
          );
          journal = {
            ...journal,
            status: 'walletRemoved',
            updatedAt: Date.now(),
          };
          await this.persistIdentityExitJournalEntry(journal);
        }

        if (
          storedPlan.target.logoutOneKeyId &&
          snapshot.oneKeyId.type === 'loggedIn'
        ) {
          await Promise.all([
            this.backgroundApi.servicePrime.logoutPrimeServerSessionBestEffort({
              accessToken: snapshot.oneKeyId.accessToken,
              callerName: 'ServiceIdentityExit.executeIdentityExit',
            }),
            revokeAuthSessionTokenOnServerBestEffort({
              authSessionSource: snapshot.oneKeyId.source,
              accessToken: snapshot.oneKeyId.accessToken,
            }),
          ]);
        }

        await this.cleanupRemovedKeylessWalletCredentials(journal);

        const localCommit =
          await this.backgroundApi.servicePrime.commitIdentityExitLocalState({
            expectedIdentityLifecycleRevision: snapshot.lifecycleRevision,
            oneKeyId:
              storedPlan.target.logoutOneKeyId &&
              snapshot.oneKeyId.type === 'loggedIn'
                ? {
                    onekeyUserId: snapshot.oneKeyId.onekeyUserId,
                    source: snapshot.oneKeyId.source,
                    sessionCommitId: snapshot.oneKeyId.sessionCommitId,
                    sessionTokenSub: snapshot.oneKeyId.sessionTokenSub,
                  }
                : undefined,
            keylessSession:
              shouldClearKeylessSession(storedPlan.target) &&
              snapshot.keyless.type === 'present'
                ? {
                    sessionCommitId: snapshot.keyless.sessionCommitId,
                    sessionTokenSub: snapshot.keyless.sessionTokenSub,
                  }
                : undefined,
            keylessWalletSession:
              (storedPlan.target.removeKeyless ||
                shouldClearKeylessSession(storedPlan.target)) &&
              snapshot.keyless.type === 'present'
                ? {
                    walletId: snapshot.keyless.walletId,
                    sessionCommitId: snapshot.keyless.walletSessionCommitId,
                  }
                : undefined,
          });
        if (localCommit.status !== 'committed' || !localCommit.revision) {
          // TODO: i18n
          throw new OneKeyLocalError(
            'Identity state changed after the operation started. Recovery is required.',
          );
        }

        journal = {
          ...journal,
          status: 'localStateCommitted',
          updatedAt: Date.now(),
          committedLifecycleRevision: localCommit.revision,
        };
        await this.persistIdentityExitJournalEntry(journal);
        const receipt = await this.completeIdentityExitJournal({
          journal,
          committedLifecycleRevision: localCommit.revision,
        });
        await this.finalizeRemovedKeylessWalletSideEffectsBestEffort(journal);
        markIdentityRecoveryReady(storedPlan.operationId);
        return receipt;
      } finally {
        endIdentityExitReservation(storedPlan.operationId);
      }
    });
  }

  @backgroundMethod()
  async executeIdentityExit({
    planId,
    acknowledgement,
  }: IExecuteIdentityExitParams): Promise<IIdentityExitReceipt> {
    const settledReceipt = getSettledIdentityExitReceipt(planId);
    if (settledReceipt) {
      return settledReceipt;
    }
    const storedPlan = planRegistry.get(planId);
    if (!storedPlan) {
      await this.recoverInterruptedIdentityExitOperations();
      const recoveredReceipt = getSettledIdentityExitReceipt(planId);
      if (recoveredReceipt) {
        return recoveredReceipt;
      }
      return {
        status: 'blocked',
        code: 'STATE_CHANGED',
        // TODO: i18n
        message: 'The identity exit plan expired. Please try again.',
      };
    }
    if (storedPlan.executionPromise) {
      return storedPlan.executionPromise;
    }
    if (storedPlan.publicPlan.expiresAt <= Date.now()) {
      planRegistry.delete(planId);
      return {
        status: 'blocked',
        code: 'STATE_CHANGED',
        // TODO: i18n
        message: 'The identity exit plan expired. Please try again.',
      };
    }
    if (
      storedPlan.publicPlan.confirmation.type ===
        'keylessRemovalAcknowledgement' &&
      acknowledgement !== 'keylessWalletRemoval'
    ) {
      // TODO: i18n
      throw new OneKeyLocalError(
        'Keyless wallet removal acknowledgement is required.',
      );
    }
    const executionPromise = this.runIdentityExit(storedPlan)
      .catch(async (error: unknown) => {
        const completedReceipt = getSettledIdentityExitReceipt(planId);
        if (completedReceipt) {
          markIdentityRecoveryReady(storedPlan.operationId);
          return completedReceipt;
        }
        if (
          this.identityExitJournalStorageOutcomeUnknownOperationIds.has(
            storedPlan.operationId,
          )
        ) {
          throw error;
        }
        await this.recoverInterruptedIdentityExitOperations();
        const recoveredReceipt = getSettledIdentityExitReceipt(planId);
        if (recoveredReceipt) {
          return recoveredReceipt;
        }
        throw error;
      })
      .then(
        (receipt) => {
          if (planRegistry.get(planId) === storedPlan) {
            planRegistry.delete(planId);
          }
          return receipt;
        },
        (error: unknown) => {
          if (planRegistry.get(planId) === storedPlan) {
            if (storedPlan.publicPlan.expiresAt <= Date.now()) {
              planRegistry.delete(planId);
            } else {
              storedPlan.executionPromise = undefined;
            }
          }
          throw error;
        },
      );
    storedPlan.executionPromise = executionPromise;
    return storedPlan.executionPromise;
  }

  private async getOAuthHandoffRecord(
    handoff: IIdentityExitOAuthHandoff,
  ): Promise<IIdentityExitOAuthHandoffRecord | undefined> {
    const journal =
      await this.backgroundApi.simpleDb.prime.getIdentityExitOperationJournal();
    const completedEntry = Object.values(journal).find(
      (entry) => entry.completed?.oauthHandoff === handoff,
    );
    if (!completedEntry) {
      return undefined;
    }
    const record =
      this.buildOAuthHandoffRecordFromCompletedJournal(completedEntry);
    if (!record || record.consumed || record.expiresAt <= Date.now()) {
      if (record) {
        settledReceiptRegistry.delete(record.planId);
      }
      await this.removeCompletedIdentityExitJournalEntry(completedEntry);
      return undefined;
    }
    this.scheduleOAuthHandoffJournalExpiryCleanup(record);
    return record;
  }

  private async assertOAuthHandoffState({
    record,
    provider,
  }: {
    record: IIdentityExitOAuthHandoffRecord;
    provider: EOAuthSocialLoginProvider;
  }): Promise<void> {
    if (
      record.consumed ||
      record.expiresAt <= Date.now() ||
      record.provider !== provider
    ) {
      // TODO: i18n
      throw new OneKeyLocalError(
        'The OAuth provider-switch handoff is invalid or expired.',
      );
    }
    const snapshot = await this.readAuthoritativeSnapshot();
    const keylessSessionSlot =
      await readPersistedAccessTokenBySessionSourceStrict(
        EPrimeAuthSessionSource.KeylessOAuth,
      );
    if (
      snapshot.lifecycleRevision !== record.expectedLifecycleRevision ||
      snapshot.oneKeyId.type !== 'loggedOut' ||
      snapshot.keyless.type !== 'absent' ||
      keylessSessionSlot.status !== 'empty'
    ) {
      // TODO: i18n
      throw new OneKeyLocalError(
        'Identity state changed before OAuth could continue.',
      );
    }
  }

  @backgroundMethod()
  async validateOAuthHandoffBeforeLaunch({
    handoff,
    provider,
  }: {
    handoff: IIdentityExitOAuthHandoff;
    provider: EOAuthSocialLoginProvider;
  }): Promise<{ valid: true }> {
    return identityLifecycleMutex.runExclusive(async () => {
      const record = await this.getOAuthHandoffRecord(handoff);
      if (!record) {
        // TODO: i18n
        throw new OneKeyLocalError(
          'The OAuth provider-switch handoff was not found.',
        );
      }
      await this.assertOAuthHandoffState({ record, provider });
      return { valid: true as const };
    });
  }

  async consumeOAuthHandoffForLogin({
    handoff,
    provider,
  }: {
    handoff: IIdentityExitOAuthHandoff;
    provider: EOAuthSocialLoginProvider;
  }): Promise<void> {
    const record = await this.getOAuthHandoffRecord(handoff);
    if (!record) {
      // TODO: i18n
      throw new OneKeyLocalError(
        'The OAuth provider-switch handoff was not found.',
      );
    }
    await this.assertOAuthHandoffState({ record, provider });
    const consumedAt = Date.now();
    let persisted: boolean;
    try {
      persisted =
        await this.backgroundApi.simpleDb.prime.consumeIdentityExitOAuthHandoff(
          {
            operationId: record.operationId,
            handoff: record.handoff,
            consumedAt,
          },
        );
    } catch (error) {
      settledReceiptRegistry.delete(record.planId);
      this.markIdentityExitJournalStorageOutcomeUnknown(record.operationId);
      throw error;
    }
    settledReceiptRegistry.delete(record.planId);
    if (!persisted) {
      // TODO: i18n
      throw new OneKeyLocalError(
        'The OAuth provider-switch handoff was already consumed.',
      );
    }
    record.consumed = true;
  }
}

export default ServiceIdentityExit;
