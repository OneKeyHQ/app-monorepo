import type {
  IHomeRuntimeJsonValue,
  IRuntimeRequestPriority,
} from '@onekeyhq/shared/src/types/homeRuntime';

import type { HomeStoreCommitBudget } from './homeStoreCommitBudget';
import type { IHomeStoreRejectReason } from '../store/homeStoreTypes';

export type IHomeResultPhase = 'leading' | 'intermediate' | 'final';

export interface IHomeResultAuthority {
  ownerScopeKey: string;
  runtimeInstanceId: string;
  appEpoch: string;
  clientInstanceId: string;
  sessionId: string;
  producerInstanceId: string;
  sourceId: string;
  sourceKey: string;
  requestSequence: number;
  sourceRevision: number;
  requestGroupId: string;
  taskId: string;
}

export interface IHomeResultPublication<TWire extends IHomeRuntimeJsonValue> {
  phase: IHomeResultPhase;
  revision: number;
  wireValue: TWire;
  coverageRevision?: string | number;
}

export interface IHomeMaterializedResult<TModel> {
  model: TModel;
  dataRevision: string | number;
  changedEntityIds?: readonly string[];
  coverageRevision?: string | number;
}

export type IHomeResultPublishOutcome =
  | { kind: 'accepted'; publicationId: string }
  | { kind: 'unchanged' }
  | { kind: 'buffered' }
  | { kind: 'backpressured'; retryable: boolean }
  | { kind: 'rejected'; reason: IHomeStoreRejectReason };

export interface IHomeResultSink<TWire extends IHomeRuntimeJsonValue> {
  publish(result: IHomeResultPublication<TWire>): IHomeResultPublishOutcome;
  flushBuffered(): IHomeResultPublishOutcome | undefined;
  dispose(): void;
}

export interface IHomeCurrentResultAuthority extends IHomeResultAuthority {
  surfaceVisibility: 'visible' | 'hidden' | 'detached';
}

export interface ICreateHomeResultSinkOptions<
  TWire extends IHomeRuntimeJsonValue,
  TModel,
> {
  authority: IHomeResultAuthority;
  priority: IRuntimeRequestPriority;
  commitBudget: HomeStoreCommitBudget;
  getCurrentAuthority(): IHomeCurrentResultAuthority | undefined;
  materialize(
    wireValue: TWire,
    previous: TModel | undefined,
  ): IHomeMaterializedResult<TModel> | Promise<IHomeMaterializedResult<TModel>>;
  commit(input: {
    authority: IHomeResultAuthority;
    materialized: IHomeMaterializedResult<TModel>;
    phase: IHomeResultPhase;
    publicationRevision: number;
  }): void;
  createPublicationId?: (revision: number) => string;
}

function authorityMatches(
  expected: IHomeResultAuthority,
  current: IHomeResultAuthority | undefined,
): boolean {
  return Boolean(
    current &&
    current.ownerScopeKey === expected.ownerScopeKey &&
    current.runtimeInstanceId === expected.runtimeInstanceId &&
    current.appEpoch === expected.appEpoch &&
    current.clientInstanceId === expected.clientInstanceId &&
    current.sessionId === expected.sessionId &&
    current.producerInstanceId === expected.producerInstanceId &&
    current.sourceId === expected.sourceId &&
    current.sourceKey === expected.sourceKey &&
    current.requestSequence === expected.requestSequence &&
    current.sourceRevision === expected.sourceRevision &&
    current.requestGroupId === expected.requestGroupId &&
    current.taskId === expected.taskId,
  );
}

function phaseRank(phase: IHomeResultPhase): number {
  if (phase === 'leading') {
    return 0;
  }
  if (phase === 'intermediate') {
    return 1;
  }
  return 2;
}

export function createHomeResultSink<
  TWire extends IHomeRuntimeJsonValue,
  TModel,
>(
  options: ICreateHomeResultSinkOptions<TWire, TModel>,
): IHomeResultSink<TWire> {
  const { authority, priority, commitBudget } = options;
  const createPublicationId =
    options.createPublicationId ??
    ((revision: number) =>
      `${authority.taskId}:${authority.requestSequence}:${revision}`);
  let disposed = false;
  let finalAccepted = false;
  let lastAcceptedRevision = -1;
  let lastAcceptedPhaseRank = -1;
  let previousModel: TModel | undefined;
  let previousDataRevision: string | number | undefined;
  let stagedHidden:
    | {
        publication: IHomeResultPublication<TWire>;
        publicationId: string;
      }
    | undefined;
  let unsubscribeAvailability: (() => void) | undefined;

  const stopAvailabilityRetry = (): void => {
    unsubscribeAvailability?.();
    unsubscribeAvailability = undefined;
  };

  function ensureAvailabilityRetry(): void {
    if (disposed || unsubscribeAvailability) {
      return;
    }
    unsubscribeAvailability = commitBudget.subscribeAvailability(() => {
      if (disposed || !stagedHidden) {
        stopAvailabilityRetry();
        return;
      }
      const current = options.getCurrentAuthority();
      if (
        !authorityMatches(authority, current) ||
        current?.surfaceVisibility !== 'visible' ||
        !commitBudget.reserve()
      ) {
        return;
      }
      const buffered = stagedHidden;
      stagedHidden = undefined;
      stopAvailabilityRetry();
      processPublication(buffered.publication, buffered.publicationId);
    });
  }

  const rejectForAuthority = (): IHomeResultPublishOutcome => ({
    kind: 'rejected',
    reason: 'sessionMismatch',
  });

  function processPublication(
    publication: IHomeResultPublication<TWire>,
    publicationId: string,
  ): void {
    const run = async () => {
      const before = options.getCurrentAuthority();
      if (
        disposed ||
        !authorityMatches(authority, before) ||
        before?.surfaceVisibility !== 'visible'
      ) {
        return;
      }
      const materialized = await options.materialize(
        publication.wireValue,
        previousModel,
      );
      const after = options.getCurrentAuthority();
      if (
        disposed ||
        !authorityMatches(authority, after) ||
        after?.surfaceVisibility !== 'visible'
      ) {
        return;
      }
      if (
        previousDataRevision !== undefined &&
        materialized.dataRevision === previousDataRevision
      ) {
        return;
      }
      const submitted = commitBudget.submit({
        authority,
        materialized,
        phase: publication.phase,
        priority,
        publicationId,
        publicationRevision: publication.revision,
        commit: () => {
          const current = options.getCurrentAuthority();
          if (!disposed && authorityMatches(authority, current)) {
            options.commit({
              authority,
              materialized,
              phase: publication.phase,
              publicationRevision: publication.revision,
            });
            previousModel = materialized.model;
            previousDataRevision = materialized.dataRevision;
          }
        },
      });
      if (!submitted && publication.phase === 'final') {
        stagedHidden = { publication, publicationId };
        ensureAvailabilityRetry();
      }
    };
    void run();
  }

  return {
    publish(publication) {
      const current = options.getCurrentAuthority();
      if (disposed || !authorityMatches(authority, current)) {
        return rejectForAuthority();
      }
      if (
        finalAccepted ||
        publication.revision <= lastAcceptedRevision ||
        phaseRank(publication.phase) < lastAcceptedPhaseRank
      ) {
        return {
          kind: 'rejected',
          reason: 'requestPhaseRegression',
        };
      }
      const publicationId = createPublicationId(publication.revision);
      lastAcceptedRevision = publication.revision;
      lastAcceptedPhaseRank = phaseRank(publication.phase);
      finalAccepted = publication.phase === 'final';
      if (current?.surfaceVisibility === 'detached') {
        return rejectForAuthority();
      }
      if (current?.surfaceVisibility === 'hidden') {
        if (publication.phase === 'intermediate') {
          return { kind: 'unchanged' };
        }
        stagedHidden = { publication, publicationId };
        return { kind: 'buffered' };
      }
      if (!commitBudget.reserve()) {
        if (publication.phase === 'final') {
          stagedHidden = { publication, publicationId };
          ensureAvailabilityRetry();
        }
        return { kind: 'backpressured', retryable: true };
      }
      processPublication(publication, publicationId);
      return { kind: 'accepted', publicationId };
    },
    flushBuffered() {
      const buffered = stagedHidden;
      if (!buffered) {
        return undefined;
      }
      const current = options.getCurrentAuthority();
      if (
        disposed ||
        !authorityMatches(authority, current) ||
        current?.surfaceVisibility !== 'visible'
      ) {
        return rejectForAuthority();
      }
      if (!commitBudget.reserve()) {
        ensureAvailabilityRetry();
        return { kind: 'backpressured', retryable: true };
      }
      stagedHidden = undefined;
      stopAvailabilityRetry();
      processPublication(buffered.publication, buffered.publicationId);
      return { kind: 'accepted', publicationId: buffered.publicationId };
    },
    dispose() {
      disposed = true;
      stopAvailabilityRetry();
      stagedHidden = undefined;
      previousModel = undefined;
    },
  };
}

export { authorityMatches };
