import appGlobals from '../appGlobals';

import type { IDefaultLogger } from './loggerImpl';

type ILoggerPathPart = string | symbol;

type ILoggerQueuedCall = {
  args: unknown[];
  path: ILoggerPathPart[];
};

type IWebLazyLoggerCallResult = {
  queuedArgs: unknown[];
  value: unknown;
};

const WEB_LAZY_LOGGER_DELAY_MS = 3000;
const WEB_LAZY_LOGGER_QUEUE_LIMIT = 200;
const WEB_LAZY_LOGGER_MARKER = Symbol('onekey.webLazyLogger');

let resolvedDefaultLogger: IDefaultLogger | undefined;
let loggerLoadPromise: Promise<IDefaultLogger> | undefined;
let loggerLoadTimer: ReturnType<typeof setTimeout> | undefined;
let webLazySendFlowId: string | undefined;

const queuedCalls: ILoggerQueuedCall[] = [];

function isWebLazyLogger(value: unknown) {
  return Boolean(
    value &&
    typeof value === 'function' &&
    (value as { [WEB_LAZY_LOGGER_MARKER]?: boolean })[WEB_LAZY_LOGGER_MARKER],
  );
}

async function loadDefaultLogger() {
  if (resolvedDefaultLogger) {
    return resolvedDefaultLogger;
  }

  const globalLogger = appGlobals.$defaultLogger;
  if (globalLogger && !isWebLazyLogger(globalLogger)) {
    resolvedDefaultLogger = globalLogger;
    return resolvedDefaultLogger;
  }

  loggerLoadPromise ??= import('./loggerImpl').then((module) => {
    resolvedDefaultLogger = module.defaultLogger;
    appGlobals.$defaultLogger = module.defaultLogger;
    return module.defaultLogger;
  });

  return loggerLoadPromise;
}

function isLoggerPath(path: ILoggerPathPart[], expected: string[]) {
  return (
    path.length === expected.length &&
    expected.every((part, index) => path[index] === part)
  );
}

function getWebLazySendFlowId() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function handleWebLazyLoggerCall(
  path: ILoggerPathPart[],
  args: unknown[],
): IWebLazyLoggerCallResult | undefined {
  if (isLoggerPath(path, ['transaction', 'send', 'startNewFlow'])) {
    const requestedFlowId = typeof args[0] === 'string' ? args[0] : undefined;
    const sendFlowId = requestedFlowId ?? getWebLazySendFlowId();
    webLazySendFlowId = sendFlowId;
    return {
      queuedArgs: [sendFlowId],
      value: sendFlowId,
    };
  }

  if (isLoggerPath(path, ['transaction', 'send', 'clearFlow'])) {
    webLazySendFlowId = undefined;
    return {
      queuedArgs: args,
      value: undefined,
    };
  }

  return undefined;
}

function getLoggerCallTarget(root: IDefaultLogger, path: ILoggerPathPart[]) {
  let receiver: unknown = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    receiver = (receiver as Record<ILoggerPathPart, unknown> | undefined)?.[
      path[i]
    ];
  }

  const methodName = path[path.length - 1];
  const method = (receiver as Record<ILoggerPathPart, unknown> | undefined)?.[
    methodName
  ];
  return { method, receiver };
}

function flushQueuedCalls(logger: IDefaultLogger) {
  const calls = queuedCalls.splice(0, queuedCalls.length);
  for (const call of calls) {
    try {
      const { method, receiver } = getLoggerCallTarget(logger, call.path);
      if (typeof method === 'function') {
        (method as (...methodArgs: unknown[]) => unknown).apply(
          receiver,
          call.args,
        );
      }
    } catch (error) {
      console.error(error);
    }
  }
}

function rejectQueuedCalls(error: unknown) {
  queuedCalls.splice(0, queuedCalls.length);
  console.error(error);
}

function scheduleLoggerLoad() {
  if (loggerLoadTimer) {
    return;
  }

  loggerLoadTimer = setTimeout(() => {
    loggerLoadTimer = undefined;
    void loadDefaultLogger().then(flushQueuedCalls).catch(rejectQueuedCalls);
  }, WEB_LAZY_LOGGER_DELAY_MS);
}

function callLoggerPath(path: ILoggerPathPart[], args: unknown[]): unknown {
  if (resolvedDefaultLogger) {
    const { method, receiver } = getLoggerCallTarget(
      resolvedDefaultLogger,
      path,
    );
    if (typeof method === 'function') {
      return (method as (...methodArgs: unknown[]) => unknown).apply(
        receiver,
        args,
      );
    }
    return undefined;
  }

  if (queuedCalls.length >= WEB_LAZY_LOGGER_QUEUE_LIMIT) {
    queuedCalls.shift();
  }
  const lazyCallResult = handleWebLazyLoggerCall(path, args);
  queuedCalls.push({ args: lazyCallResult?.queuedArgs ?? args, path });
  scheduleLoggerLoad();
  return lazyCallResult?.value;
}

function createLoggerProxy(path: ILoggerPathPart[] = []): unknown {
  const proxyTarget = function webLazyDefaultLoggerProxy() {};
  const proxy = new Proxy(proxyTarget, {
    get(_target, prop) {
      if (prop === 'then') {
        return undefined;
      }
      if (prop === WEB_LAZY_LOGGER_MARKER) {
        return true;
      }
      if (prop === Symbol.toStringTag) {
        return 'WebLazyDefaultLogger';
      }
      const nextPath = [...path, prop];
      if (isLoggerPath(nextPath, ['transaction', 'send', 'sendFlowId'])) {
        return (
          resolvedDefaultLogger?.transaction.send.sendFlowId ??
          webLazySendFlowId
        );
      }
      return createLoggerProxy(nextPath);
    },
    apply(_target, _thisArg, args) {
      const result = callLoggerPath(path, args);
      return result;
    },
  });
  return proxy;
}

const defaultLogger = createLoggerProxy() as IDefaultLogger;
appGlobals.$defaultLogger = defaultLogger;

export { defaultLogger };
export type { IDefaultLogger };
