import { useMemo } from 'react';

import { useHomeStoreInternalActions } from '@onekeyhq/kit/src/states/jotai/contexts/home/actions';

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
