import { getSharedRPC } from '@onekeyfe/react-native-background-thread';

import {
  BACKGROUND_THREAD_READY_KEY,
  serializeBackgroundThreadReadyPayload,
} from './runtimeReady';

type IBackgroundRuntimeGlobal = typeof globalThis & {
  __setupBackgroundRPCHandler?: () => void;
};

const READY_SIGNAL_RETRY_MS = 50;
const MAX_READY_SIGNAL_RETRY_COUNT = 600;

let readySignalRetryCount = 0;
let readySignalRetryTimer: ReturnType<typeof setTimeout> | undefined;
let readySignalEmitted = false;

function emitBackgroundRuntimeReadySignal() {
  if (readySignalEmitted) {
    return true;
  }

  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    return false;
  }

  sharedRPC.write(
    BACKGROUND_THREAD_READY_KEY,
    serializeBackgroundThreadReadyPayload(),
  );
  readySignalEmitted = true;
  return true;
}

function scheduleBackgroundRuntimeReadySignal() {
  if (
    readySignalEmitted ||
    readySignalRetryTimer ||
    readySignalRetryCount >= MAX_READY_SIGNAL_RETRY_COUNT
  ) {
    return;
  }

  readySignalRetryTimer = setTimeout(() => {
    readySignalRetryTimer = undefined;
    readySignalRetryCount += 1;

    if (!emitBackgroundRuntimeReadySignal()) {
      scheduleBackgroundRuntimeReadySignal();
    }
  }, READY_SIGNAL_RETRY_MS);
}

export function setupBackgroundThreadRPCHandler() {
  const runtimeGlobal = globalThis as IBackgroundRuntimeGlobal;

  runtimeGlobal.__setupBackgroundRPCHandler = () => {
    if (!emitBackgroundRuntimeReadySignal()) {
      scheduleBackgroundRuntimeReadySignal();
    }
  };

  if (!emitBackgroundRuntimeReadySignal()) {
    scheduleBackgroundRuntimeReadySignal();
  }
}

setupBackgroundThreadRPCHandler();
