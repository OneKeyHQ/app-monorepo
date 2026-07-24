import { useMemo } from 'react';

import { useHomeStoreInternalActions } from '@onekeyhq/kit/src/states/jotai/contexts/home/actions';

import type { IPreparedHomeDisplaySnapshot } from '../cacheV2/loadPreparedHomeDisplaySnapshot';
import type { IHomeStoreEvent } from '../store/homeStoreTypes';

type IHomeControllerEventPayload<TType extends IHomeStoreEvent['type']> = Omit<
  Extract<IHomeStoreEvent, { type: TType }>,
  'type'
>;

export function useHomeStoreControllerActions() {
  const actions = useHomeStoreInternalActions();

  return useMemo(
    () => ({
      controllerLeaseKey: actions.current.dispatchHomeEvent,
      publishHomeOwnerChanged: (
        payload: IHomeControllerEventPayload<'ownerChanged'>,
      ) => {
        actions.current.dispatchHomeEvent({
          type: 'ownerChanged',
          ...payload,
        });
      },
      publishHomeRuntimeChanged: (
        payload: IHomeControllerEventPayload<'runtimeChanged'>,
      ) => {
        actions.current.dispatchHomeEvent({
          type: 'runtimeChanged',
          ...payload,
        });
      },
      publishHomeFactsChanged: (
        payload: IHomeControllerEventPayload<'factsChanged'>,
      ) => {
        actions.current.dispatchHomeEvent({
          type: 'factsChanged',
          ...payload,
        });
      },
      publishPreparedHomeOwner: ({
        displaySnapshot,
        facts,
        owner,
        runtime,
      }: {
        displaySnapshot?: IPreparedHomeDisplaySnapshot;
        facts?: IHomeControllerEventPayload<'factsChanged'>;
        owner: IHomeControllerEventPayload<'ownerChanged'>;
        runtime: IHomeControllerEventPayload<'runtimeChanged'>;
      }) => {
        const ownerToken = owner.ownerToken;
        actions.current.dispatchHomeEventsAtomically({
          displaySnapshotLoadState: ownerToken
            ? {
                ownerScopeKey: ownerToken.scopeKey,
                sessionId: ownerToken.sessionId,
                status: displaySnapshot ? 'hit' : 'miss',
              }
            : { status: 'idle' },
          events: [
            { type: 'ownerChanged', ...owner },
            { type: 'runtimeChanged', ...runtime },
            ...(facts ? [{ type: 'factsChanged' as const, ...facts }] : []),
            ...(displaySnapshot && ownerToken
              ? [
                  {
                    type: 'displaySnapshotHydrated' as const,
                    ownerScopeKey: ownerToken.scopeKey,
                    sessionId: ownerToken.sessionId,
                    ...displaySnapshot,
                  },
                ]
              : []),
          ],
        });
      },
      hydrateHomeConfirmedSnapshot: (
        payload: IHomeControllerEventPayload<'confirmedSnapshotHydrated'>,
      ) => {
        actions.current.dispatchHomeEvent({
          type: 'confirmedSnapshotHydrated',
          ...payload,
        });
      },
      hydrateHomeDisplaySnapshot: (
        payload: IHomeControllerEventPayload<'displaySnapshotHydrated'>,
      ) => {
        actions.current.dispatchHomeEvent({
          type: 'displaySnapshotHydrated',
          ...payload,
        });
      },
      stopHomeStore: () => {
        actions.current.dispatchHomeEvent({ type: 'stopped' });
      },
      markHomeSectionCommandHandled: (
        payload: IHomeControllerEventPayload<'commandHandled'>,
      ) => {
        actions.current.dispatchHomeEvent({
          type: 'commandHandled',
          ...payload,
        });
      },
    }),
    [actions],
  );
}
