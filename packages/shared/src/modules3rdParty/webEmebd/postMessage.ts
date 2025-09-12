export enum EWebEmbedPostMessageType {
  TrackEvent = 'trackEvent',
  CaptureException = 'captureException',
}

export const postMessage = (data: any) => {
  if (typeof globalThis !== 'undefined' && 'ReactNativeWebView' in globalThis) {
    (
      globalThis.ReactNativeWebView as {
        postMessage: (message: string) => void;
      }
    )?.postMessage(JSON.stringify(data));
  }
};
