import { NativeModules } from 'react-native';

const { BackgroundRunnerModule } = NativeModules as unknown as {
  BackgroundRunnerModule: {
    postMessage: (message: string) => void;
    onMessage: (
      callback: (error: Error | null, message: Record<string, any>) => void,
    ) => void;
  };
};

type ICallback = (message: Record<string, any>) => void;

const callbacks: Set<ICallback> = new Set();
const onMessageCallback = (
  error: Error | null,
  message: Record<string, any>,
) => {
  callbacks.forEach((callback: ICallback) => callback(message));
};

BackgroundRunnerModule.onMessage(onMessageCallback);

export const nativeUIBridge = {
  postMessage: (message: Record<string, any>) => {
    BackgroundRunnerModule.postMessage(JSON.stringify(message));
  },
  onMessage: (callback: (message: Record<string, any>) => void) => {
    callbacks.add(callback);
    return () => {
      callbacks.delete(callback);
    };
  },
};
