export const nativeBGBridge = {
  postHostMessage: (message: Record<string, any>) => {},
  onHostMessage: (callback: (message: Record<string, any>) => void) => () => {},
};

export const nativeUIBridge = {
  postMessage: (message: Record<string, any>) => {},
  onMessage: (callback: (message: Record<string, any>) => void) => () => {},
};
