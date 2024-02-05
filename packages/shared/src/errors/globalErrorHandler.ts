import platformEnv from '../platformEnv';

import nativePromiseRejectionTracker from './nativePromiseRejectionTracker';
import { toPlainErrorObject } from './utils/errorUtils';

import type { IOneKeyError } from './types/errorTypes';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const noop = (error: Error) => undefined;

interface IGlobalErrorListenerInfo {
  nativeErrorListener: (error: Error, isFatal?: boolean) => void;
  errorListener: (event: ErrorEvent) => void;
  promiseErrorListener: (event: PromiseRejectionEvent) => void;
}

function logErrorDetail(error: any) {
  const plainError = toPlainErrorObject(error);
  console.warn('globalErrorHandler Error log: \n', plainError);
}

class GlobalErrorHandler {
  listenersMap = new Map<any, IGlobalErrorListenerInfo>();

  // handle autoToast error here by BackgroundApiProxyBase
  addListener(listener: (error: IOneKeyError) => void) {
    const map: IGlobalErrorListenerInfo = {
      nativeErrorListener: (error: Error) => {
        listener(error);
        logErrorDetail(error);
      },
      errorListener: (event: ErrorEvent) => {
        listener(event.error);
        logErrorDetail(event.error);
      },
      promiseErrorListener: (event: PromiseRejectionEvent) => {
        listener(event.reason);
        logErrorDetail(event.reason);
      },
    };
    if (platformEnv.isNative) {
      nativePromiseRejectionTracker.setErrorTracker(map.nativeErrorListener);
    } else {
      // web or service-worker(ext mv3)
      global.addEventListener('error', map.errorListener);
      global.addEventListener('unhandledrejection', map.promiseErrorListener);
    }
    this.listenersMap.set(listener, map);
  }

  removeListener(listener: (error: Error) => void) {
    const map = this.listenersMap.get(listener);
    if (platformEnv.isNative) {
      nativePromiseRejectionTracker.setErrorTracker(noop);
    } else {
      if (map?.errorListener) {
        global.removeEventListener('error', map?.errorListener);
      }
      if (map?.promiseErrorListener) {
        global.removeEventListener(
          'unhandledrejection',
          map?.promiseErrorListener,
        );
      }
    }
  }
}

const globalErrorHandler = new GlobalErrorHandler();

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$globalErrorHandler = globalErrorHandler;
}

export { globalErrorHandler };
