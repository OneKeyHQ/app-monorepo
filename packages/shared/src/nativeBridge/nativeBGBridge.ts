type ICallback = (message: Record<string, any>) => void;

const callbacks: Set<ICallback> = new Set();
const onMessageCallback: ICallback = (message: Record<string, any>) => {
  callbacks.forEach((callback: ICallback) => callback(message));
};

let isReady = false;

let waitMessages: Record<string, any>[] = [];

function checkReady(times = 0) {
  if (globalThis.$$isNativeUiThread || times > 10_000) {
    return;
  }
  if (
    typeof globalThis.postHostMessage === 'function' &&
    typeof globalThis.onHostMessage === 'function'
  ) {
    isReady = true;
    globalThis.onHostMessage(onMessageCallback);
    setTimeout(() => {
      console.log('waitMessages.length', waitMessages.length);
      waitMessages.forEach((message) => {
        globalThis.postHostMessage(message);
      });
      waitMessages = [];
    }, 0);
  } else {
    console.log('checkReady', times);
    setTimeout(() => checkReady(times + 1), 10);
  }
}

checkReady();

const checkThread = () => {
  if (!globalThis.$$isNativeUiThread) {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(
      'this function is not available in native background thread',
    );
  }
};

export const nativeBGBridge = {
  postHostMessage: (message: Record<string, any>) => {
    checkThread();
    if (!isReady) {
      waitMessages.push(message);
      return;
    }
    globalThis.postHostMessage(message);
  },
  onHostMessage: (callback: (message: Record<string, any>) => void) => {
    checkThread();
    if (!isReady) {
      return;
    }
    callbacks.add(callback);
    return () => {
      callbacks.delete(callback);
    };
  },
};
