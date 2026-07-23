import { useRef } from 'react';

import {
  createInitialHomeStoreResources,
  createInitialHomeStoreSection,
} from '@onekeyhq/kit/src/views/Home/model/store/homeStoreInitialState';
import {
  applyHomeStorePatchToState,
  reduceHomeStore,
} from '@onekeyhq/kit/src/views/Home/model/store/homeStoreReducer';
import type {
  IHomeSetOrReset,
  IHomeStoreEvent,
  IHomeStoreIntent,
  IHomeStoreMutation,
  IHomeStoreState,
} from '@onekeyhq/kit/src/views/Home/model/store/homeStoreTypes';
import type {
  IJotaiGetter,
  IJotaiSetter,
} from '@onekeyhq/kit-bg/src/states/jotai/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  contextAtomMethod,
  homeBalanceRoundState,
  homeCapabilityInputsState,
  homeCommitIdentityState,
  homeConfirmedBalanceState,
  homeDiagnosticsState,
  homeEnvironmentInputsState,
  homeFactsState,
  homeInteractionState,
  homeNavigationState,
  homeRuntimeState,
  homeSessionState,
  homeShellState,
  homeWalletInputsState,
  initial,
  resourceStates,
  sectionStates,
} from './atoms';

function readHomeStoreState(get: IJotaiGetter): IHomeStoreState {
  return {
    session: get(homeSessionState.atom()),
    runtime: get(homeRuntimeState.atom()),
    walletInputs: get(homeWalletInputsState.atom()),
    environmentInputs: get(homeEnvironmentInputsState.atom()),
    capabilityInputs: get(homeCapabilityInputsState.atom()),
    facts: get(homeFactsState.atom()),
    resources: {
      capability: get(resourceStates.capability.atom()),
      banner: get(
        resourceStates.banner.atom(),
      ) as IHomeStoreState['resources']['banner'],
      portfolio: get(resourceStates.portfolio.atom()),
      perps: get(resourceStates.perps.atom()),
      defi: get(resourceStates.defi.atom()),
      nft: get(resourceStates.nft.atom()),
      history: get(resourceStates.history.atom()),
      market: get(resourceStates.market.atom()),
    },
    balanceRound: get(homeBalanceRoundState.atom()),
    confirmedBalance: get(homeConfirmedBalanceState.atom()),
    interaction: get(homeInteractionState.atom()),
    shell: get(homeShellState.atom()),
    navigation: get(homeNavigationState.atom()),
    sections: {
      portfolio: get(sectionStates.portfolio.atom()),
      perps: get(sectionStates.perps.atom()),
      defi: get(sectionStates.defi.atom()),
      nft: get(sectionStates.nft.atom()),
      history: get(sectionStates.history.atom()),
      market: get(sectionStates.market.atom()),
    },
    diagnostics: get(homeDiagnosticsState.atom()),
    commitIdentity: get(homeCommitIdentityState.atom()),
  };
}

function resolveOperation<T>(
  operation: IHomeSetOrReset<T>,
  initialValue: T,
): T {
  return operation.kind === 'set' ? operation.value : initialValue;
}

function applyHomeMutation(
  set: IJotaiSetter,
  mutation: IHomeStoreMutation,
): void {
  const initialResources = createInitialHomeStoreResources();
  switch (mutation.slice) {
    case 'session':
      set(
        homeSessionState.atom(),
        resolveOperation(mutation.operation, initial.session),
      );
      return;
    case 'runtime':
      set(
        homeRuntimeState.atom(),
        resolveOperation(mutation.operation, initial.runtime),
      );
      return;
    case 'walletInputs':
      set(
        homeWalletInputsState.atom(),
        resolveOperation(mutation.operation, initial.walletInputs),
      );
      return;
    case 'environmentInputs':
      set(
        homeEnvironmentInputsState.atom(),
        resolveOperation(mutation.operation, initial.environmentInputs),
      );
      return;
    case 'capabilityInputs':
      set(
        homeCapabilityInputsState.atom(),
        resolveOperation(mutation.operation, initial.capabilityInputs),
      );
      return;
    case 'facts':
      set(
        homeFactsState.atom(),
        mutation.operation.kind === 'set'
          ? mutation.operation.value
          : undefined,
      );
      return;
    case 'resource':
      set(
        resourceStates[mutation.sourceId].atom(),
        resolveOperation(
          mutation.operation,
          initialResources[mutation.sourceId],
        ),
      );
      return;
    case 'balanceRound':
      set(
        homeBalanceRoundState.atom(),
        mutation.operation.kind === 'set'
          ? mutation.operation.value
          : undefined,
      );
      return;
    case 'confirmedBalance':
      set(
        homeConfirmedBalanceState.atom(),
        mutation.operation.kind === 'set'
          ? mutation.operation.value
          : undefined,
      );
      return;
    case 'interaction':
      set(
        homeInteractionState.atom(),
        resolveOperation(mutation.operation, initial.interaction),
      );
      return;
    case 'shell':
      set(
        homeShellState.atom(),
        resolveOperation(mutation.operation, initial.shell),
      );
      return;
    case 'navigation':
      set(
        homeNavigationState.atom(),
        resolveOperation(mutation.operation, initial.navigation),
      );
      return;
    case 'section':
      set(
        sectionStates[mutation.sectionId].atom(),
        resolveOperation(
          mutation.operation,
          createInitialHomeStoreSection(mutation.sectionId),
        ),
      );
      return;
    case 'diagnostics':
      set(
        homeDiagnosticsState.atom(),
        resolveOperation(mutation.operation, initial.diagnostics),
      );
      return;
    default:
      assertNever(mutation);
  }
}

function dispatchHomeStoreEvent(
  get: IJotaiGetter,
  set: IJotaiSetter,
  event: IHomeStoreEvent,
) {
  const current = readHomeStoreState(get);
  const transition = reduceHomeStore(current, event);
  if (transition.patch.mutations.length === 0) {
    return transition.effects;
  }
  transition.patch.mutations.forEach((mutation) => {
    applyHomeMutation(set, mutation);
  });
  const changedSourceIds = Array.from(
    new Set(
      transition.patch.mutations.flatMap((mutation) =>
        mutation.slice === 'resource' ? [mutation.sourceId] : [],
      ),
    ),
  );
  const presentationChanged = transition.patch.mutations.some(
    (mutation) =>
      mutation.slice === 'interaction' ||
      mutation.slice === 'shell' ||
      mutation.slice === 'navigation',
  );
  set(homeCommitIdentityState.atom(), {
    storeCommitId: current.commitIdentity.storeCommitId + 1,
    origin:
      event.type === 'displaySnapshotHydrated' ||
      event.type === 'confirmedSnapshotHydrated'
        ? 'cacheHydrate'
        : 'storeEvent',
    changedSourceIds,
    presentationChanged,
    ownerChanged: event.type === 'ownerChanged',
  });
  return transition.effects;
}

class ContextJotaiActionsHome extends ContextJotaiActionsBase {
  dispatchHomeEvent = contextAtomMethod(dispatchHomeStoreEvent);

  readHomeStoreSnapshot = contextAtomMethod((get) => readHomeStoreState(get));

  dispatchHomeIntent = contextAtomMethod((get, set, intent: IHomeStoreIntent) =>
    dispatchHomeStoreEvent(get, set, {
      type: 'intentReceived',
      intent,
    }),
  );
}

const createActions = memoFn(() => new ContextJotaiActionsHome());

export function useHomeStoreInternalActions() {
  const actions = createActions();
  const dispatchHomeEvent = actions.dispatchHomeEvent.use();
  const readHomeStoreSnapshot = actions.readHomeStoreSnapshot.use();
  return useRef({ dispatchHomeEvent, readHomeStoreSnapshot });
}

export function useHomeStoreIntentActions() {
  const actions = createActions();
  const dispatchHomeIntent = actions.dispatchHomeIntent.use();
  return useRef({ dispatchHomeIntent });
}

function assertNever(value: never): never {
  throw new OneKeyLocalError(`Unhandled Home Store mutation: ${String(value)}`);
}

export { applyHomeMutation, applyHomeStorePatchToState, readHomeStoreState };
