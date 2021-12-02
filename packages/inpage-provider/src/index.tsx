import { injectedDesktop, injectedNative } from './injected-autogen';

// TODO: Webview building not working yet
//    need withExpo in webpack.config.js
// import DesktopWebView from './webview/DesktopWebView';
// export { default as NativeWebView } from './webview/NativeWebView';

export default { injectedDesktop, injectedNative };
export { injectedDesktop, injectedNative };
