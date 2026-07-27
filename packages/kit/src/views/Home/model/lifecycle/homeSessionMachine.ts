import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IHomeRuntimeHandshake,
  IHomeRuntimeOwnerScope,
  IHomeRuntimeOwnerToken,
} from '@onekeyhq/shared/src/types/homeRuntime';

import { createHomeOwnerToken } from '../core/homeIdentity';

export type IHomeSessionAuthority =
  | 'idle'
  | 'waitingForProducer'
  | 'ready'
  | 'degraded'
  | 'stopped';

export interface IHomeLifecycleSessionState {
  mode: 'wallet' | 'urlAccount';
  runtimeInstanceId: string;
  appEpoch: string;
  clientInstanceId: string;
  owner?: IHomeRuntimeOwnerScope;
  ownerToken?: IHomeRuntimeOwnerToken;
  authority: IHomeSessionAuthority;
  appActivity: 'active' | 'inactive' | 'background';
  surfaceVisibility: 'visible' | 'hidden' | 'detached';
  producerInstanceId?: string;
  handshakeRevision: number;
  sessionSequence: number;
  sessionId: string;
}

export type IHomeSessionMachineEffect =
  | {
      kind: 'cancelSession';
      sessionId: string;
    }
  | { kind: 'connectRuntime'; sessionId: string }
  | { kind: 'reconcileSourcePlan'; sessionId: string }
  | {
      kind: 'recoverRuntime';
      sessionId: string;
      recoverySequence: number;
    };

export type IHomeSessionMachineEvent =
  | {
      type: 'ownerChanged';
      owner?: IHomeRuntimeOwnerScope;
    }
  | {
      type: 'runtimeHandshakeSucceeded';
      appEpoch: string;
      producerInstanceId: string;
    }
  | { type: 'runtimeHandshakeFailed'; exhausted: boolean }
  | {
      type: 'appActivityChanged';
      appActivity: IHomeLifecycleSessionState['appActivity'];
    }
  | {
      type: 'surfaceVisibilityChanged';
      surfaceVisibility: IHomeLifecycleSessionState['surfaceVisibility'];
    }
  | { type: 'runtimeRecovered'; recoverySequence: number }
  | { type: 'stopped' };

export interface IHomeSessionMachineTransition {
  state: IHomeLifecycleSessionState;
  effects: readonly IHomeSessionMachineEffect[];
}

export function createInitialHomeLifecycleSessionState({
  appEpoch,
  clientInstanceId,
  mode,
  runtimeInstanceId,
}: Pick<
  IHomeLifecycleSessionState,
  'appEpoch' | 'clientInstanceId' | 'mode' | 'runtimeInstanceId'
>): IHomeLifecycleSessionState {
  return {
    mode,
    runtimeInstanceId,
    appEpoch,
    clientInstanceId,
    authority: 'idle',
    appActivity: 'active',
    surfaceVisibility: 'visible',
    handshakeRevision: 0,
    sessionSequence: 0,
    sessionId: `${runtimeInstanceId}:0`,
  };
}

function sameOwner(
  left: IHomeRuntimeOwnerScope | undefined,
  right: IHomeRuntimeOwnerScope | undefined,
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  if (
    left.walletId !== right.walletId ||
    left.accountId !== right.accountId ||
    left.network.kind !== right.network.kind
  ) {
    return false;
  }
  return (
    left.network.kind === 'allNetworks' ||
    (right.network.kind === 'singleNetwork' &&
      left.network.networkId === right.network.networkId)
  );
}

export function transitionHomeSession(
  state: IHomeLifecycleSessionState,
  event: IHomeSessionMachineEvent,
): IHomeSessionMachineTransition {
  if (state.authority === 'stopped' && event.type !== 'stopped') {
    return { state, effects: [] };
  }
  switch (event.type) {
    case 'ownerChanged': {
      if (sameOwner(state.owner, event.owner)) {
        return { state, effects: [] };
      }
      const effects: IHomeSessionMachineEffect[] = [];
      if (state.ownerToken) {
        effects.push({
          kind: 'cancelSession',
          sessionId: state.ownerToken.sessionId,
        });
      }
      if (!event.owner) {
        return {
          state: {
            ...state,
            owner: undefined,
            ownerToken: undefined,
            producerInstanceId: undefined,
            authority: 'idle',
          },
          effects,
        };
      }
      // Never reuse a session ID across owners; late results must remain bound
      // to the authority of the owner that started them.
      const sessionSequence = state.sessionSequence + 1;
      const sessionId = `${state.runtimeInstanceId}:${sessionSequence}`;
      effects.push({ kind: 'connectRuntime', sessionId });
      return {
        state: {
          ...state,
          owner: event.owner,
          ownerToken: createHomeOwnerToken({
            owner: event.owner,
            sessionId,
          }),
          producerInstanceId: undefined,
          authority: 'waitingForProducer',
          sessionSequence,
          sessionId,
        },
        effects,
      };
    }
    case 'runtimeHandshakeSucceeded': {
      if (!state.ownerToken) {
        return { state, effects: [] };
      }
      const next = {
        ...state,
        appEpoch: event.appEpoch,
        producerInstanceId: event.producerInstanceId,
        authority: 'ready' as const,
        handshakeRevision: state.handshakeRevision + 1,
      };
      return {
        state: next,
        effects: [{ kind: 'reconcileSourcePlan', sessionId: next.sessionId }],
      };
    }
    case 'runtimeHandshakeFailed': {
      if (!event.exhausted || state.authority === 'degraded') {
        return { state, effects: [] };
      }
      return {
        state: { ...state, authority: 'degraded' },
        effects: [],
      };
    }
    case 'appActivityChanged': {
      if (state.appActivity === event.appActivity) {
        return { state, effects: [] };
      }
      const next = { ...state, appActivity: event.appActivity };
      return {
        state: next,
        effects: state.ownerToken
          ? [{ kind: 'reconcileSourcePlan', sessionId: next.sessionId }]
          : [],
      };
    }
    case 'surfaceVisibilityChanged': {
      if (state.surfaceVisibility === event.surfaceVisibility) {
        return { state, effects: [] };
      }
      const next = {
        ...state,
        surfaceVisibility: event.surfaceVisibility,
      };
      const effects: IHomeSessionMachineEffect[] = [];
      if (event.surfaceVisibility === 'detached' && state.ownerToken) {
        effects.push({
          kind: 'cancelSession',
          sessionId: state.ownerToken.sessionId,
        });
      } else if (state.ownerToken) {
        effects.push({
          kind: 'reconcileSourcePlan',
          sessionId: state.ownerToken.sessionId,
        });
      }
      return { state: next, effects };
    }
    case 'runtimeRecovered':
      return state.ownerToken
        ? {
            state: {
              ...state,
              authority: 'waitingForProducer',
              producerInstanceId: undefined,
            },
            effects: [
              {
                kind: 'cancelSession',
                sessionId: state.ownerToken.sessionId,
              },
              {
                kind: 'recoverRuntime',
                sessionId: state.ownerToken.sessionId,
                recoverySequence: event.recoverySequence,
              },
            ],
          }
        : { state, effects: [] };
    case 'stopped': {
      if (state.authority === 'stopped') {
        return { state, effects: [] };
      }
      return {
        state: {
          ...state,
          authority: 'stopped',
          surfaceVisibility: 'detached',
        },
        effects: state.ownerToken
          ? [
              {
                kind: 'cancelSession',
                sessionId: state.ownerToken.sessionId,
              },
            ]
          : [],
      };
    }
    default:
      return assertNever(event);
  }
}

function assertNever(value: never): never {
  throw new OneKeyLocalError(`Unhandled Home session event: ${String(value)}`);
}

export type IHomeSessionStatus =
  | 'waitingForProducer'
  | 'active'
  | 'degraded'
  | 'stopped';

export interface IHomeSessionSnapshot {
  ownerToken: IHomeRuntimeOwnerToken;
  status: IHomeSessionStatus;
  producerInstanceId?: string;
}

export class HomeSessionMachine {
  readonly ownerToken: IHomeRuntimeOwnerToken;

  private status: IHomeSessionStatus = 'waitingForProducer';

  private producerInstanceId: string | undefined;

  constructor({
    owner,
    sessionId,
  }: {
    owner: IHomeRuntimeOwnerScope;
    sessionId: string;
  }) {
    this.ownerToken = createHomeOwnerToken({ owner, sessionId });
  }

  applyHandshake(handshake: IHomeRuntimeHandshake): void {
    if (this.status === 'stopped') {
      return;
    }
    this.producerInstanceId = handshake.producerInstanceId;
    this.status = 'active';
  }

  markDegraded(): void {
    if (this.status !== 'stopped') {
      this.status = 'degraded';
    }
  }

  stop(): void {
    this.status = 'stopped';
  }

  getSnapshot(): IHomeSessionSnapshot {
    return {
      ownerToken: this.ownerToken,
      status: this.status,
      producerInstanceId: this.producerInstanceId,
    };
  }
}
