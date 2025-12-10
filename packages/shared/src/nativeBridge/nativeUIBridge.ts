import { NativeModules } from 'react-native';

const { BackgroundRunnerModule } = NativeModules as unknown as {
  BackgroundRunnerModule: {
    postMessage: (message: string) => void;
    onMessage: (
      callback: (error: Error | null, message: string) => void,
    ) => void;
  };
};

type ICallback = (message: Record<string, any>) => void;

const callbacks: Set<ICallback> = new Set();
const onMessageCallback = (error: Error | null, message: string) => {
  console.log('onMessageCallback', message);
  callbacks.forEach((callback: ICallback) => callback(JSON.parse(message)));
};

// BackgroundRunnerModule.onMessage(onMessageCallback);

const checkThread = () => {
  if (!globalThis.$$isNativeUiThread) {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error('this function is not available in native ui thread');
  }
};

export const nativeUIBridge = {
  postMessage: (message: Record<string, any>) => {
    checkThread();
    BackgroundRunnerModule.postMessage(JSON.stringify(message));
  },
  onMessage: (callback: (message: Record<string, any>) => void) => {
    checkThread();
    callbacks.add(callback);
    return () => {
      callbacks.delete(callback);
    };
  },
};
