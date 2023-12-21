import type { INativePromiseRejectionTracker } from './nativePromiseRejectionTrackerTypes';

const nativePromiseRejectionTracker: INativePromiseRejectionTracker = {
  getUnhandledPromiseRejectionTracker() {
    return undefined;
  },
  setErrorTracker() {
    //
    console.error(
      'setUnhandledPromiseRejectionTracker is only available for native',
    );
  },
};

export default nativePromiseRejectionTracker;
