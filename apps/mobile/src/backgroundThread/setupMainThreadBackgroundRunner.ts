import {
  type ISharedRPC,
  getSharedRPC,
} from '@onekeyfe/react-native-background-thread';

import {
  BACKGROUND_THREAD_READY_KEY,
  parseBackgroundThreadReadyPayload,
} from './runtimeReady';
import { setBackgroundThreadReadyPayload } from './runtimeState';

const OBSERVER_RETRY_MS = 50;
const MAX_OBSERVER_RETRY_COUNT = 600;

let observerRetryCount = 0;
let observerRetryTimer: ReturnType<typeof setTimeout> | undefined;
let observerInstalled = false;

function syncBackgroundRuntimeReady(sharedRPC: ISharedRPC) {
  const payload = parseBackgroundThreadReadyPayload(
    sharedRPC.read(BACKGROUND_THREAD_READY_KEY),
  );

  if (payload) {
    setBackgroundThreadReadyPayload(payload);
  }
}

function installBackgroundRuntimeObserver(sharedRPC: ISharedRPC) {
  if (!observerInstalled) {
    observerInstalled = true;
    sharedRPC.onWrite((callId) => {
      if (callId !== BACKGROUND_THREAD_READY_KEY) {
        return;
      }

      syncBackgroundRuntimeReady(sharedRPC);
    });
  }

  syncBackgroundRuntimeReady(sharedRPC);
}

function ensureBackgroundRuntimeObserver() {
  const sharedRPC = getSharedRPC();
  if (sharedRPC) {
    installBackgroundRuntimeObserver(sharedRPC);
    return;
  }

  if (
    observerInstalled ||
    observerRetryTimer ||
    observerRetryCount >= MAX_OBSERVER_RETRY_COUNT
  ) {
    return;
  }

  observerRetryTimer = setTimeout(() => {
    observerRetryTimer = undefined;
    observerRetryCount += 1;
    ensureBackgroundRuntimeObserver();
  }, OBSERVER_RETRY_MS);
}

export function setupMainThreadBackgroundRunner() {
  ensureBackgroundRuntimeObserver();
}

setupMainThreadBackgroundRunner();
