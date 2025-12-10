type ICallback = (message: Record<string, any>) => void;

const callbacks: Set<ICallback> = new Set();
const onMessageCallback: ICallback = (message: Record<string, any>) => {
  callbacks.forEach((callback: ICallback) => callback(message));
};

let isReady = false;

let waitMessages: Record<string, any>[] = [];

function checkReady(times = 0) {
  if (times > 10_000) {
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

export const nativeBGBridge = {
  postHostMessage: (message: Record<string, any>) => {
    if (!isReady) {
      waitMessages.push(message);
      return;
    }
    globalThis.postHostMessage(message);
  },
  onHostMessage: (callback: (message: Record<string, any>) => void) => {
    if (!isReady) {
      return;
    }
    callbacks.add(callback);
    return () => {
      callbacks.delete(callback);
    };
  },
};
