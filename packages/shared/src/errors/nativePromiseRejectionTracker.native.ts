/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// https://github.com/iyegoroff/react-native-promise-rejection-utils/blob/master/index.js
// https://github.com/getsentry/sentry-react-native/blob/main/src/js/integrations/reactnativeerrorhandlers.ts

import type { INativePromiseRejectionTracker } from './nativePromiseRejectionTrackerTypes';

const RNErrorUtils = ErrorUtils;
const legacyDefaultErrorHandler = RNErrorUtils.getGlobalHandler();

let errorTracker: (error: Error) => void;
let errorHandlerInstalled = false;
let hermesTrackerPrepared = false;
let sdkOptions: IHermesRejectionOptions | undefined;

export type IHermesRejectionOptions = {
  allRejections: true;
  onUnhandled?: (
    id: number,
    error: unknown,
    promise?: Promise<unknown>,
  ) => void;
  onHandled?: (id: number, error?: unknown, promise?: Promise<unknown>) => void;
};

type IHermesPromiseAPI = {
  hasPromise?: () => boolean;
  enablePromiseRejectionTracker?: (options: IHermesRejectionOptions) => void;
};

function getHermesPromiseAPI(): IHermesPromiseAPI | undefined {
  return (
    globalThis as typeof globalThis & { HermesInternal?: IHermesPromiseAPI }
  ).HermesInternal;
}

const defaultPromiseRejectionHandler = (id: string, error: unknown) => {
  // eslint-disable-next-line no-param-reassign
  error = error === undefined ? {} : error;
  let message: string | undefined;
  let stack;

  try {
    const stringValue = Object.prototype.toString.call(error);
    if (stringValue === '[object Error]') {
      message = Error.prototype.toString.call(error);
      stack = (error as Error).stack;
    } else {
      message = require('pretty-format').format(error);
    }
  } catch {
    // Do not retry serialization of a value whose formatter or accessor failed.
    message = '[Unable to format promise rejection]';
  }

  const warning =
    `Possible Unhandled Promise Rejection (id: ${id}): ${message || ''}` +
    `\n${stack === null || stack === undefined ? '' : stack}`;
  console.warn(warning);
};

let promiseRejectionHandler = __DEV__
  ? defaultPromiseRejectionHandler
  : undefined;

const getUnhandledPromiseRejectionTracker = () => promiseRejectionHandler;

// Hermes implements tracker registration by mutating its Promise constructor.
// Install the native hooks while the vetted shim window is still open. Later
// RN/Sentry registrations only update callbacks, preserving the frozen Promise.
export function prepareNativePromiseRejectionTracker() {
  if (process.env.ONEKEY_MOBILE_LOCKDOWN === 'false' || hermesTrackerPrepared)
    return;
  const hermes = getHermesPromiseAPI();
  if (!hermes?.hasPromise?.()) return;
  if (
    typeof hermes.enablePromiseRejectionTracker !== 'function' ||
    Object.isFrozen(Promise)
  ) {
    // eslint-disable-next-line onekey/no-raw-error, no-restricted-syntax -- the native API must be installed before intrinsics are hardened
    throw new Error(
      'Hermes Promise tracking must be prepared before lockdown.',
    );
  }
  if (__DEV__) {
    // RN installs these options during InitializeCore, before this shim runs.
    sdkOptions =
      require('react-native/Libraries/promiseRejectionTrackingOptions')
        .default as IHermesRejectionOptions;
  }
  const nativeEnable = hermes.enablePromiseRejectionTracker;
  nativeEnable.call(hermes, {
    allRejections: true,
    onUnhandled: (id, error, promise) => {
      try {
        sdkOptions?.onUnhandled?.(id, error, promise);
      } finally {
        if (errorHandlerInstalled && promiseRejectionHandler)
          promiseRejectionHandler(String(id), error);
        else if (!sdkOptions?.onUnhandled)
          defaultPromiseRejectionHandler(String(id), error);
      }
    },
    onHandled: (id, error, promise) => {
      sdkOptions?.onHandled?.(id, error, promise);
    },
  });
  hermesTrackerPrepared = true;
}

// Sentry uses this observer instead of re-registering Hermes' native hooks after
// hardening. It retains the SDK's original unhandled-rejection capture path.
export function setNativePromiseRejectionTrackingOptions(
  options: IHermesRejectionOptions,
) {
  if (
    !hermesTrackerPrepared ||
    options?.allRejections !== true ||
    Object.keys(options).some(
      (key) => !['allRejections', 'onUnhandled', 'onHandled'].includes(key),
    ) ||
    (options.onUnhandled !== undefined &&
      typeof options.onUnhandled !== 'function') ||
    (options.onHandled !== undefined && typeof options.onHandled !== 'function')
  ) {
    // eslint-disable-next-line onekey/no-raw-error, no-restricted-syntax -- validate the native tracker compatibility contract
    throw new Error(
      'Unsupported or unprepared Hermes Promise rejection tracking options.',
    );
  }
  sdkOptions = options;
}

const setErrorTracker = (tracker: (error: Error) => void) => {
  errorTracker = tracker;
  const usesProtectedHermesPromise =
    process.env.ONEKEY_MOBILE_LOCKDOWN !== 'false' &&
    getHermesPromiseAPI()?.hasPromise?.() === true;
  if (usesProtectedHermesPromise && !hermesTrackerPrepared) {
    // eslint-disable-next-line onekey/no-raw-error, no-restricted-syntax -- do not replace repaired intrinsics when the startup shim was omitted
    throw new Error(
      'Hermes Promise tracking was not prepared before lockdown.',
    );
  }

  if (!usesProtectedHermesPromise) {
    RNErrorUtils.setGlobalHandler((error, isFatal) => {
      legacyDefaultErrorHandler(error, isFatal);
      tracker(error);
    });
  } else if (!errorHandlerInstalled) {
    // Preserve the current Sentry/native error chain. Replacing an app listener
    // must not overwrite later SDK wrappers or install duplicate handlers.
    const previousHandler = RNErrorUtils.getGlobalHandler();
    RNErrorUtils.setGlobalHandler((error, isFatal) => {
      try {
        previousHandler(error, isFatal);
      } finally {
        errorTracker(error);
      }
    });
    errorHandlerInstalled = true;
  }
  promiseRejectionHandler = (id: string, error: unknown) => {
    try {
      defaultPromiseRejectionHandler(id, error);
    } finally {
      // The legacy application listener declares Error, but historically receives
      // the original rejection value. Preserve that value without normalization.
      errorTracker(error as Error);
    }
  };
  if (usesProtectedHermesPromise) return;

  const {
    polyfillGlobal,
  } = require('react-native/Libraries/Utilities/PolyfillFunctions');

  polyfillGlobal('Promise', () => {
    require('promise/setimmediate/done');
    require('promise/setimmediate/finally');
    const Promise = require('promise/setimmediate/es6-extensions');
    if (typeof Promise.withResolvers !== 'function') {
      Promise.withResolvers = function withResolvers() {
        let resolve;
        let reject;
        // @ts-expect-error
        const promise = new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        });
        return { promise, resolve, reject };
      };
    }
    const tracking = require('promise/setimmediate/rejection-tracking');

    tracking.enable({
      allRejections: true,
      onUnhandled: promiseRejectionHandler,
    });
    return Promise;
  });
};

const nativePromiseRejectionTracker: INativePromiseRejectionTracker = {
  getUnhandledPromiseRejectionTracker,
  setErrorTracker,
};

export default nativePromiseRejectionTracker;
