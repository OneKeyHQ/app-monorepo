// `react-native-webview/src` holds the package's native component specs and uses
// React Native deep imports that the strict TypeScript API no longer exposes.
// tsconfig `paths` points `react-native-webview/src/WebViewShared` here so
// type-checking does not pull that source tree in; keep in sync with upstream.
export declare const ERROR_CODE: {
  CONNECTION_FAILED: number;
};
