/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// https://github.com/iyegoroff/react-native-promise-rejection-utils/blob/master/index.js
// https://github.com/getsentry/sentry-react-native/blob/main/src/js/integrations/reactnativeerrorhandlers.ts

import type { INativePromiseRejectionTracker } from './nativePromiseRejectionTrackerTypes';

const RNErrorUtils = ErrorUtils;

const defaultErrorHandler = RNErrorUtils.getGlobalHandler();

const defaultPromiseRejectionHandler = (id: string, error: Error) => {
  // eslint-disable-next-line no-param-reassign
  error = error === undefined ? ({} as unknown as any) : error;
  let message: string | undefined;
  let stack;

  const stringValue = Object.prototype.toString.call(error);
  if (stringValue === '[object Error]') {
    message = Error.prototype.toString.call(error);
    stack = error.stack;
  } else {
    try {
      message = require('pretty-format')(error);
    } catch {
      message = typeof error === 'string' ? error : JSON.stringify(error);
    }
  }

  const warning =
    `Possible Unhandled Promise Rejection (id: ${id}): ${message || ''}` +
    `\n${stack == null ? '' : stack}`;
  console.warn(warning);
};

let promiseRejectionHandler = __DEV__
  ? defaultPromiseRejectionHandler
  : undefined;

const getUnhandledPromiseRejectionTracker = () => promiseRejectionHandler;

const setErrorTracker = (tracker: (error: Error) => void) => {
  promiseRejectionHandler = (id: string, error: Error) => {
    defaultPromiseRejectionHandler(id, error);
    tracker(error);
  };

  RNErrorUtils.setGlobalHandler((error, isFatal) => {
    defaultErrorHandler(error, isFatal);
    tracker(error);
  });

  const {
    polyfillGlobal,
  } = require('react-native/Libraries/Utilities/PolyfillFunctions');

  polyfillGlobal('Promise', () => {
    require('promise/setimmediate/done');
    require('promise/setimmediate/finally');
    const Promise = require('promise/setimmediate/es6-extensions');
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
