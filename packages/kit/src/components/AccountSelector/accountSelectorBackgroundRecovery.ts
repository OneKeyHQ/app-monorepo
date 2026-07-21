import type { INativeBackgroundThreadReadySignal } from '@onekeyhq/kit-bg/src/apis/BackgroundApiProxyBase';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export type IAccountSelectorBackgroundRecoveryOwner = {
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
};

export type IAccountSelectorBackgroundRecoveryEvent = {
  owner: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl: string;
  };
  readySignal: INativeBackgroundThreadReadySignal;
};

type IAccountSelectorBackgroundRecoveryListener = (
  event: IAccountSelectorBackgroundRecoveryEvent,
) => void;

type IAccountSelectorBackgroundRecoveryChannel = {
  claimedSequenceByConsumer: Map<string, number>;
  listeners: Set<IAccountSelectorBackgroundRecoveryListener>;
  latestEvent?: IAccountSelectorBackgroundRecoveryEvent;
  latestRawReadyEvent?: IAccountSelectorBackgroundRecoveryEvent;
  rawReadyListeners: Set<IAccountSelectorBackgroundRecoveryListener>;
};

type IAccountSelectorBackgroundRecoveryState = Map<
  string,
  IAccountSelectorBackgroundRecoveryChannel
>;

type IAccountSelectorBackgroundRecoveryGlobal = typeof globalThis & {
  __onekeyAccountSelectorBackgroundRecoveryState?: IAccountSelectorBackgroundRecoveryState;
};

function buildOwnerKey({
  sceneName,
  sceneUrl,
}: IAccountSelectorBackgroundRecoveryOwner): string {
  return `${sceneName}:${sceneUrl ?? ''}`;
}

function getState(): IAccountSelectorBackgroundRecoveryState {
  const runtimeGlobal = globalThis as IAccountSelectorBackgroundRecoveryGlobal;
  if (!runtimeGlobal.__onekeyAccountSelectorBackgroundRecoveryState) {
    runtimeGlobal.__onekeyAccountSelectorBackgroundRecoveryState = new Map();
  }
  return runtimeGlobal.__onekeyAccountSelectorBackgroundRecoveryState;
}

function getChannel(
  owner: IAccountSelectorBackgroundRecoveryOwner,
): IAccountSelectorBackgroundRecoveryChannel {
  const state = getState();
  const ownerKey = buildOwnerKey(owner);
  let channel = state.get(ownerKey);
  if (!channel) {
    channel = {
      claimedSequenceByConsumer: new Map(),
      listeners: new Set(),
      rawReadyListeners: new Set(),
    };
    state.set(ownerKey, channel);
  } else if (!channel.rawReadyListeners) {
    // Fast Refresh can retain a channel created by an older module revision.
    channel.rawReadyListeners = new Set();
  }
  return channel;
}

function notifyListener(
  listener: IAccountSelectorBackgroundRecoveryListener,
  event: IAccountSelectorBackgroundRecoveryEvent,
) {
  try {
    listener(event);
  } catch {
    // A failed Home consumer must not block the remaining recovery owners.
  }
}

export function publishAccountSelectorBackgroundRecoveryComplete({
  owner,
  readySignal,
}: {
  owner: IAccountSelectorBackgroundRecoveryOwner;
  readySignal: INativeBackgroundThreadReadySignal;
}): IAccountSelectorBackgroundRecoveryEvent | undefined {
  const channel = getChannel(owner);
  if (
    channel.latestRawReadyEvent?.readySignal.sequence !== readySignal.sequence
  ) {
    return undefined;
  }
  const previousEvent = channel.latestEvent;
  if (
    previousEvent &&
    previousEvent.readySignal.sequence >= readySignal.sequence
  ) {
    return previousEvent;
  }
  const event: IAccountSelectorBackgroundRecoveryEvent = {
    owner: {
      sceneName: owner.sceneName,
      sceneUrl: owner.sceneUrl ?? '',
    },
    readySignal,
  };
  channel.latestEvent = event;
  channel.listeners.forEach((listener) => notifyListener(listener, event));
  return event;
}

export function markAccountSelectorBackgroundRecoveryRawReady({
  owner,
  readySignal,
}: {
  owner: IAccountSelectorBackgroundRecoveryOwner;
  readySignal: INativeBackgroundThreadReadySignal;
}): IAccountSelectorBackgroundRecoveryEvent {
  const channel = getChannel(owner);
  const previousEvent = channel.latestRawReadyEvent;
  if (
    previousEvent &&
    previousEvent.readySignal.sequence >= readySignal.sequence
  ) {
    return previousEvent;
  }
  const event: IAccountSelectorBackgroundRecoveryEvent = {
    owner: {
      sceneName: owner.sceneName,
      sceneUrl: owner.sceneUrl ?? '',
    },
    readySignal,
  };
  channel.latestRawReadyEvent = event;
  channel.rawReadyListeners.forEach((listener) =>
    notifyListener(listener, event),
  );
  return event;
}

export function onAccountSelectorBackgroundRecoveryComplete(
  owner: IAccountSelectorBackgroundRecoveryOwner,
  listener: IAccountSelectorBackgroundRecoveryListener,
  options?: { afterSequence?: number },
): () => void {
  const channel = getChannel(owner);
  channel.listeners.add(listener);
  if (
    channel.latestEvent &&
    channel.latestEvent.readySignal.sequence >
      (options?.afterSequence ?? Number.NEGATIVE_INFINITY)
  ) {
    notifyListener(listener, channel.latestEvent);
  }
  return () => {
    channel.listeners.delete(listener);
  };
}

export function onAccountSelectorBackgroundRecoveryRawReady(
  owner: IAccountSelectorBackgroundRecoveryOwner,
  listener: IAccountSelectorBackgroundRecoveryListener,
  options?: { afterSequence?: number },
): () => void {
  const channel = getChannel(owner);
  channel.rawReadyListeners.add(listener);
  if (
    channel.latestRawReadyEvent &&
    channel.latestRawReadyEvent.readySignal.sequence >
      (options?.afterSequence ?? Number.NEGATIVE_INFINITY)
  ) {
    notifyListener(listener, channel.latestRawReadyEvent);
  }
  return () => {
    channel.rawReadyListeners.delete(listener);
  };
}

export function getAccountSelectorBackgroundRecoverySequence(
  owner: IAccountSelectorBackgroundRecoveryOwner,
): number | undefined {
  return getChannel(owner).latestEvent?.readySignal.sequence;
}

export function getAccountSelectorBackgroundRecoveryRawReadySequence(
  owner: IAccountSelectorBackgroundRecoveryOwner,
): number | undefined {
  return getChannel(owner).latestRawReadyEvent?.readySignal.sequence;
}

export function isAccountSelectorBackgroundRecoveryRawReadySequenceCurrent({
  owner,
  sequence,
}: {
  owner: IAccountSelectorBackgroundRecoveryOwner;
  sequence: number;
}): boolean {
  return (
    getChannel(owner).latestRawReadyEvent?.readySignal.sequence === sequence
  );
}

export function claimAccountSelectorBackgroundRecovery({
  consumerId,
  owner,
  sequence,
}: {
  consumerId: string;
  owner: IAccountSelectorBackgroundRecoveryOwner;
  sequence: number;
}): boolean {
  const channel = getChannel(owner);
  if (
    channel.latestRawReadyEvent?.readySignal.sequence !== sequence ||
    channel.latestEvent?.readySignal.sequence !== sequence
  ) {
    return false;
  }
  const claimedSequence = channel.claimedSequenceByConsumer.get(consumerId);
  if (claimedSequence !== undefined && claimedSequence >= sequence) {
    return false;
  }
  channel.claimedSequenceByConsumer.set(consumerId, sequence);
  return true;
}
