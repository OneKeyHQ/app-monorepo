import { OneKeyLocalError } from '../errors';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import platformEnv from '../platformEnv';

import {
  type INativeStorageContractViolation,
  type INativeStorageGlobal,
  parseNativeStorageContractViolation,
} from './nativeStorageTypes';

const MAX_PENDING_VIOLATIONS = 20;
const MAX_REPORTED_API_NAMES = 100;
const MAX_STACK_LENGTH = 12_000;

type INativeStorageContractViolationListener = (
  violation: INativeStorageContractViolation,
) => void;

let violationSequence = 0;
let isMainHandlerInstalled = false;
let isSentryReady = false;

const handledViolationIds = new Set<string>();
const reportedApiNames = new Set<string>();
const pendingMainNotifications: INativeStorageContractViolation[] = [];
const pendingSentryReports: INativeStorageContractViolation[] = [];
const listeners = new Set<INativeStorageContractViolationListener>();

export class NativeStorageContractViolationError extends OneKeyLocalError {
  readonly apiName: string;

  readonly runtime: INativeStorageContractViolation['runtime'];

  constructor(
    apiName: string,
    runtime: INativeStorageContractViolation['runtime'],
  ) {
    super(
      `Unsupported AsyncStorage API "${apiName}" was accessed in the ${runtime} runtime. Add a BG MMKV proxy implementation before using it.`,
    );
    Object.defineProperty(this, 'name', {
      configurable: true,
      value: 'NativeStorageContractViolationError',
      writable: true,
    });
    this.apiName = apiName;
    this.runtime = runtime;
  }
}

function appendBounded<T>(items: T[], item: T) {
  if (items.length >= MAX_PENDING_VIOLATIONS) {
    items.shift();
  }
  items.push(item);
}

function getRuntime(): INativeStorageContractViolation['runtime'] {
  return platformEnv.isNativeBackgroundThread ? 'background' : 'main';
}

function buildViolation(
  error: NativeStorageContractViolationError,
): INativeStorageContractViolation {
  violationSequence += 1;
  return {
    apiName: error.apiName,
    id: `${error.runtime}:${Date.now()}:${violationSequence}`,
    message: error.message,
    runtime: error.runtime,
    stack: error.stack?.slice(0, MAX_STACK_LENGTH),
  };
}

function notifyMainListeners(violation: INativeStorageContractViolation) {
  if (listeners.size === 0) {
    appendBounded(pendingMainNotifications, violation);
    return;
  }
  listeners.forEach((listener) => {
    try {
      listener(violation);
    } catch (error) {
      console.error(
        '[NativeStorageContractViolation] UI notification failed',
        error,
      );
    }
  });
}

function toError(violation: INativeStorageContractViolation) {
  const error = new NativeStorageContractViolationError(
    violation.apiName,
    violation.runtime,
  );
  error.message = violation.message;
  if (violation.stack) {
    error.stack = violation.stack;
  }
  return error;
}

async function captureViolation(violation: INativeStorageContractViolation) {
  try {
    const { captureException } = await import('../modules3rdParty/sentry');
    captureException(toError(violation), {
      tags: {
        native_runtime: violation.runtime,
        storage_api: violation.apiName,
        storage_contract: 'AsyncStorageBgMMKVProxy',
      },
    });
  } catch (error) {
    console.error(
      '[NativeStorageContractViolation] Sentry reporting failed',
      error,
    );
  }
}

function enqueueOrCaptureSentry(violation: INativeStorageContractViolation) {
  if (!platformEnv.isProduction) {
    return;
  }
  if (!isSentryReady) {
    appendBounded(pendingSentryReports, violation);
    return;
  }
  void captureViolation(violation);
}

function handleViolationInMain(
  value: unknown,
  options: { log: boolean } = { log: true },
) {
  const violation = parseNativeStorageContractViolation(value);
  if (!violation || handledViolationIds.has(violation.id)) {
    return;
  }
  handledViolationIds.add(violation.id);
  if (handledViolationIds.size > MAX_REPORTED_API_NAMES) {
    handledViolationIds.clear();
    handledViolationIds.add(violation.id);
  }

  if (options.log) {
    console.error(
      `[NativeStorageContractViolation] ${violation.message}\n${violation.stack ?? ''}`,
    );
  }
  if (!platformEnv.isProduction) {
    notifyMainListeners(violation);
  }
  enqueueOrCaptureSentry(violation);
}

function enqueueBackgroundViolation(
  violation: INativeStorageContractViolation,
) {
  const runtimeGlobal = globalThis as INativeStorageGlobal;
  const delivered =
    runtimeGlobal.__onekeyNativeStorageContractViolationBroadcast?.(
      violation,
    ) ?? false;
  if (delivered) {
    return;
  }
  const queue =
    runtimeGlobal.__onekeyNativeStorageContractViolationQueue ??
    (runtimeGlobal.__onekeyNativeStorageContractViolationQueue = []);
  appendBounded(queue, violation);
}

export function installNativeStorageContractViolationMainHandler() {
  if (!platformEnv.isNativeMainThread || isMainHandlerInstalled) {
    return;
  }
  isMainHandlerInstalled = true;
  appEventBus.on(
    EAppEventBusNames.NativeStorageContractViolation,
    handleViolationInMain,
  );
}

export function markNativeStorageContractViolationSentryReady() {
  isSentryReady = true;
  if (!platformEnv.isProduction) {
    pendingSentryReports.length = 0;
    return;
  }
  pendingSentryReports.splice(0).forEach((violation) => {
    void captureViolation(violation);
  });
}

export function subscribeNativeStorageContractViolations(
  listener: INativeStorageContractViolationListener,
) {
  listeners.add(listener);
  pendingMainNotifications.splice(0).forEach((violation) => {
    listener(violation);
  });
  return () => {
    listeners.delete(listener);
  };
}

export function reportUnsupportedAsyncStorageApi(apiName: string) {
  const safeApiName = apiName.slice(0, 200);
  const runtime = getRuntime();
  const error = new NativeStorageContractViolationError(safeApiName, runtime);

  console.error(
    `[NativeStorageContractViolation] ${error.message}\n${error.stack ?? ''}`,
  );

  const reportKey = `${runtime}:${safeApiName}`;
  if (!reportedApiNames.has(reportKey)) {
    if (reportedApiNames.size >= MAX_REPORTED_API_NAMES) {
      reportedApiNames.clear();
    }
    reportedApiNames.add(reportKey);
    const violation = buildViolation(error);
    if (runtime === 'background') {
      enqueueBackgroundViolation(violation);
    } else {
      handleViolationInMain(violation, { log: false });
    }
  }

  return error;
}
