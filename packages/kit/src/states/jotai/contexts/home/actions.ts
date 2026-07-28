import { useRef } from 'react';

/* eslint-disable max-classes-per-file -- Prototype-backed lazy slices avoid rebuilding getter closures for every Store event. */

import { getHomeRuntimeDispatcher } from '@onekeyhq/kit/src/views/Home/model/runtime/homeRuntimeRegistry';
import {
  createInitialHomeStoreResources,
  createInitialHomeStoreSection,
} from '@onekeyhq/kit/src/views/Home/model/store/homeStoreInitialState';
import {
  applyHomeStorePatchToState,
  reduceHomeStore,
} from '@onekeyhq/kit/src/views/Home/model/store/homeStoreReducer';
import type {
  IHomeCommandExecution,
  IHomeDispatchReceipt,
  IHomeSetOrReset,
  IHomeStoreEffect,
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
  homeDisplaySnapshotLoadState,
  homeEnvironmentInputsState,
  homeFactsState,
  homeHeaderPresentationState,
  homeInteractionState,
  homeNavigationState,
  homeRuntimeState,
  homeSessionState,
  homeShellState,
  homeWalletInputsState,
  initial,
  resourceStates,
  sectionStates,
  useHomeContextStore,
} from './atoms';

import type { IHomeDisplaySnapshotLoadState } from './atoms';

export function readHomeStoreState(get: IJotaiGetter): IHomeStoreState {
  return {
    session: get(homeSessionState.atom()),
    runtime: get(homeRuntimeState.atom()),
    headerPresentation: get(homeHeaderPresentationState.atom()),
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

type IHomeTopLevelSlice = Exclude<
  keyof IHomeStoreState,
  'resources' | 'sections'
>;
type IHomeResourceState = IHomeStoreState['resources'];
type IHomeSectionState = IHomeStoreState['sections'];

class LazyHomeResourceState implements IHomeResourceState {
  private readonly overrides = new Map<
    keyof IHomeStoreState['resources'],
    IHomeStoreState['resources'][keyof IHomeStoreState['resources']]
  >();

  constructor(private readonly get: IJotaiGetter) {}

  get capability() {
    return this.read('capability');
  }

  get banner() {
    return this.read('banner');
  }

  get portfolio() {
    return this.read('portfolio');
  }

  get perps() {
    return this.read('perps');
  }

  get defi() {
    return this.read('defi');
  }

  get nft() {
    return this.read('nft');
  }

  get history() {
    return this.read('history');
  }

  get market() {
    return this.read('market');
  }

  set(mutation: Extract<IHomeStoreMutation, { slice: 'resource' }>): void {
    this.overrides.set(
      mutation.sourceId,
      mutation.operation.kind === 'set'
        ? mutation.operation.value
        : createInitialHomeStoreResources()[mutation.sourceId],
    );
  }

  private read<TSourceId extends keyof IHomeStoreState['resources']>(
    sourceId: TSourceId,
  ): IHomeStoreState['resources'][TSourceId] {
    if (this.overrides.has(sourceId)) {
      return this.overrides.get(
        sourceId,
      ) as IHomeStoreState['resources'][TSourceId];
    }
    return this.get(
      resourceStates[sourceId].atom(),
    ) as IHomeStoreState['resources'][TSourceId];
  }
}

class LazyHomeSectionState implements IHomeSectionState {
  private readonly overrides = new Map<
    keyof IHomeStoreState['sections'],
    IHomeStoreState['sections'][keyof IHomeStoreState['sections']]
  >();

  constructor(private readonly get: IJotaiGetter) {}

  get portfolio() {
    return this.read('portfolio');
  }

  get perps() {
    return this.read('perps');
  }

  get defi() {
    return this.read('defi');
  }

  get nft() {
    return this.read('nft');
  }

  get history() {
    return this.read('history');
  }

  get market() {
    return this.read('market');
  }

  set(mutation: Extract<IHomeStoreMutation, { slice: 'section' }>): void {
    this.overrides.set(
      mutation.sectionId,
      mutation.operation.kind === 'set'
        ? mutation.operation.value
        : createInitialHomeStoreSection(mutation.sectionId),
    );
  }

  private read<TSectionId extends keyof IHomeStoreState['sections']>(
    sectionId: TSectionId,
  ): IHomeStoreState['sections'][TSectionId] {
    if (this.overrides.has(sectionId)) {
      return this.overrides.get(
        sectionId,
      ) as IHomeStoreState['sections'][TSectionId];
    }
    return this.get(
      sectionStates[sectionId].atom(),
    ) as IHomeStoreState['sections'][TSectionId];
  }
}

class LazyHomeStoreState implements IHomeStoreState {
  readonly resources: IHomeStoreState['resources'];

  readonly sections: IHomeStoreState['sections'];

  private readonly resourceState: LazyHomeResourceState;

  private readonly sectionState: LazyHomeSectionState;

  private readonly overrides = new Map<IHomeTopLevelSlice, unknown>();

  constructor(private readonly get: IJotaiGetter) {
    this.resourceState = new LazyHomeResourceState(get);
    this.sectionState = new LazyHomeSectionState(get);
    this.resources = this.resourceState;
    this.sections = this.sectionState;
  }

  get session() {
    return this.read('session');
  }

  get runtime() {
    return this.read('runtime');
  }

  get headerPresentation() {
    return this.read('headerPresentation');
  }

  get walletInputs() {
    return this.read('walletInputs');
  }

  get environmentInputs() {
    return this.read('environmentInputs');
  }

  get capabilityInputs() {
    return this.read('capabilityInputs');
  }

  get facts() {
    return this.read('facts');
  }

  get balanceRound() {
    return this.read('balanceRound');
  }

  get confirmedBalance() {
    return this.read('confirmedBalance');
  }

  get interaction() {
    return this.read('interaction');
  }

  get shell() {
    return this.read('shell');
  }

  get navigation() {
    return this.read('navigation');
  }

  get diagnostics() {
    return this.read('diagnostics');
  }

  get commitIdentity() {
    return this.read('commitIdentity');
  }

  applyMutations(mutations: readonly IHomeStoreMutation[]): void {
    mutations.forEach((mutation) => {
      switch (mutation.slice) {
        case 'resource':
          this.resourceState.set(mutation);
          return;
        case 'section':
          this.sectionState.set(mutation);
          return;
        case 'facts':
        case 'balanceRound':
        case 'confirmedBalance':
          this.overrides.set(
            mutation.slice,
            mutation.operation.kind === 'set'
              ? mutation.operation.value
              : undefined,
          );
          return;
        default:
          this.overrides.set(
            mutation.slice,
            resolveOperation(mutation.operation, initial[mutation.slice]),
          );
      }
    });
  }

  private read<TSlice extends IHomeTopLevelSlice>(
    slice: TSlice,
  ): IHomeStoreState[TSlice] {
    if (this.overrides.has(slice)) {
      return this.overrides.get(slice) as IHomeStoreState[TSlice];
    }
    let value: unknown;
    switch (slice) {
      case 'session':
        value = this.get(homeSessionState.atom());
        break;
      case 'runtime':
        value = this.get(homeRuntimeState.atom());
        break;
      case 'headerPresentation':
        value = this.get(homeHeaderPresentationState.atom());
        break;
      case 'walletInputs':
        value = this.get(homeWalletInputsState.atom());
        break;
      case 'environmentInputs':
        value = this.get(homeEnvironmentInputsState.atom());
        break;
      case 'capabilityInputs':
        value = this.get(homeCapabilityInputsState.atom());
        break;
      case 'facts':
        value = this.get(homeFactsState.atom());
        break;
      case 'balanceRound':
        value = this.get(homeBalanceRoundState.atom());
        break;
      case 'confirmedBalance':
        value = this.get(homeConfirmedBalanceState.atom());
        break;
      case 'interaction':
        value = this.get(homeInteractionState.atom());
        break;
      case 'shell':
        value = this.get(homeShellState.atom());
        break;
      case 'navigation':
        value = this.get(homeNavigationState.atom());
        break;
      case 'diagnostics':
        value = this.get(homeDiagnosticsState.atom());
        break;
      case 'commitIdentity':
        value = this.get(homeCommitIdentityState.atom());
        break;
      default:
        assertNever(slice);
    }
    return value as IHomeStoreState[TSlice];
  }
}

export function readHomeStoreStateLazily(get: IJotaiGetter): IHomeStoreState {
  return new LazyHomeStoreState(get);
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
    case 'headerPresentation':
      set(
        homeHeaderPresentationState.atom(),
        resolveOperation(mutation.operation, initial.headerPresentation),
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

export function dispatchHomeStoreEvent(
  get: IJotaiGetter,
  set: IJotaiSetter,
  event: IHomeStoreEvent,
) {
  return dispatchHomeStoreEventsAtomically(get, set, {
    events: [event],
  });
}

export function dispatchHomeStoreEventsAtomically(
  get: IJotaiGetter,
  set: IJotaiSetter,
  {
    displaySnapshotLoadState,
    events,
  }: {
    displaySnapshotLoadState?: IHomeDisplaySnapshotLoadState;
    events: readonly IHomeStoreEvent[];
  },
) {
  const lazyState = new LazyHomeStoreState(get);
  const effects: IHomeStoreEffect[] = [];
  const mutations: IHomeStoreMutation[] = [];
  events.forEach((event) => {
    const transition = reduceHomeStore(lazyState, event);
    effects.push(...transition.effects);
    mutations.push(...transition.patch.mutations);
    lazyState.applyMutations(transition.patch.mutations);
  });
  if (mutations.length === 0) {
    if (displaySnapshotLoadState) {
      set(homeDisplaySnapshotLoadState.atom(), displaySnapshotLoadState);
    }
    return effects;
  }
  mutations.forEach((mutation) => {
    applyHomeMutation(set, mutation);
  });
  const changedSourceIds = Array.from(
    new Set(
      mutations.flatMap((mutation) =>
        mutation.slice === 'resource' ? [mutation.sourceId] : [],
      ),
    ),
  );
  const presentationChanged = mutations.some(
    (mutation) =>
      mutation.slice === 'headerPresentation' ||
      mutation.slice === 'shell' ||
      mutation.slice === 'navigation',
  );
  const cacheHydrated = events.some(
    (event) =>
      event.type === 'displaySnapshotHydrated' ||
      event.type === 'confirmedSnapshotHydrated',
  );
  set(homeCommitIdentityState.atom(), {
    storeCommitId: lazyState.commitIdentity.storeCommitId + 1,
    origin: cacheHydrated ? 'cacheHydrate' : 'storeEvent',
    changedSourceIds,
    presentationChanged,
    ownerChanged: events.some((event) => event.type === 'ownerChanged'),
  });
  if (displaySnapshotLoadState) {
    set(homeDisplaySnapshotLoadState.atom(), displaySnapshotLoadState);
  }
  return effects;
}

export const dispatchHomeStoreEventsTransaction = contextAtomMethod(
  dispatchHomeStoreEventsAtomically,
);

class ContextJotaiActionsHome extends ContextJotaiActionsBase {
  dispatchHomeEvent = contextAtomMethod(dispatchHomeStoreEvent);

  dispatchHomeEventsAtomically = dispatchHomeStoreEventsTransaction;

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
  const dispatchHomeEventsAtomically =
    actions.dispatchHomeEventsAtomically.use();
  const readHomeStoreSnapshot = actions.readHomeStoreSnapshot.use();
  return useRef({
    dispatchHomeEvent,
    dispatchHomeEventsAtomically,
    readHomeStoreSnapshot,
  });
}

export function useHomeStoreIntentActions() {
  const store = useHomeContextStore();
  const actionsRef = useRef<{
    dispatchHomeIntent: (intent: IHomeStoreIntent) => IHomeDispatchReceipt;
    executeHomeCommand: <TResult>(
      intent: IHomeStoreIntent,
    ) => IHomeCommandExecution<TResult>;
  }>({
    dispatchHomeIntent: (intent) => {
      const runtime = getHomeRuntimeDispatcher(store);
      if (!runtime) {
        return { accepted: false, rejectReason: 'runtimeDisposed' };
      }
      return runtime.dispatch({
        type: 'intentReceived',
        intent,
      });
    },
    executeHomeCommand: <TResult>(intent: IHomeStoreIntent) => {
      const runtime = getHomeRuntimeDispatcher(store);
      if (!runtime) {
        return {
          receipt: { accepted: false, rejectReason: 'runtimeDisposed' },
          completion: Promise.resolve({
            kind: 'cancelled',
            reason: 'disposed',
          }),
        };
      }
      return runtime.executeIntent<TResult>(intent);
    },
  });
  return actionsRef;
}

function assertNever(value: never): never {
  throw new OneKeyLocalError(`Unhandled Home Store mutation: ${String(value)}`);
}

export { applyHomeMutation, applyHomeStorePatchToState };
