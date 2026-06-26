import type { ILaunchOptionsManagerInterface } from './type';

// Desktop cold-start timing anchors on the Electron MAIN process creation time
// (`process.getCreationTime()`), bridged to the renderer via
// `globalThis.desktopApi.processStartAt` (see registerInfoHandlers.ts +
// preload.ts). This matches the native LaunchOptionsManager, which uses the OS
// process start time, so jsReadyTime / uiVisibleTime measure from the true
// "app launched" moment — covering main-process spawn + window creation — rather
// than from renderer document load (the default `.ts` variant's anchor).
//
// All endpoints here are wall-clock epoch ms: `processStartAt` comes from the OS
// (process spawn), while `$$onekeyJsReadyAt` / `$$onekeyUIVisibleAt` are
// `Date.now()` stamped in the renderer. Subtracting epoch from epoch is valid.
// Reads the main-process creation time bridged onto `globalThis.desktopApi`
// (set by apps/desktop preload.ts from process.getCreationTime via IPC). Named
// distinctly from the main-process `getProcessStartAt()` helper that *produces*
// the value — this is the renderer-side consumer of the bridged field.
const getBridgedProcessStartAt = (): number =>
  globalThis.desktopApi?.processStartAt || 0;

// Fallback anchor: renderer document-load time, stamped in
// `packages/shared/src/web/index.html`. Used only when the main-process
// creation time is somehow unavailable (e.g. older preload without the field).
const getRendererStartAt = (): number => globalThis.$$onekeyStartupTimeAt || 0;

const getStartupTimeAt = (): number => {
  const processStartAt = getBridgedProcessStartAt();
  if (processStartAt > 0) {
    return processStartAt;
  }
  return getRendererStartAt();
};

const getJSReadyTimeAt = (): number => globalThis.$$onekeyJsReadyAt || 0;

const getUIVisibleTimeAt = (): number => globalThis.$$onekeyUIVisibleAt || 0;

const LaunchOptionsManager: ILaunchOptionsManagerInterface = {
  getLaunchOptions: () => Promise.resolve(null),
  clearLaunchOptions: () => Promise.resolve(true),
  getDeviceToken: () => Promise.resolve(null),
  getStartupTime: () => {
    return Promise.resolve(getStartupTimeAt());
  },
  getStartupTimeAt: () => {
    return Promise.resolve(getStartupTimeAt());
  },
  getJSReadyTimeAt: () => {
    return Promise.resolve(getJSReadyTimeAt());
  },
  getUIVisibleTimeAt: () => {
    return Promise.resolve(getUIVisibleTimeAt());
  },
  getJSReadyTime: async () => {
    const jsReadyAt = getJSReadyTimeAt();
    const startupAt = getStartupTimeAt();
    const duration = jsReadyAt && startupAt ? jsReadyAt - startupAt : 0;
    return Promise.resolve(duration > 0 ? duration : 0);
  },
  getUIVisibleTime: async () => {
    const startupAt = getStartupTimeAt();
    const uiVisibleAt = getUIVisibleTimeAt();
    const duration = uiVisibleAt && startupAt ? uiVisibleAt - startupAt : 0;
    return Promise.resolve(duration > 0 ? duration : 0);
  },
  getBundleStartTime: () => {
    return Promise.resolve(0);
  },
  getJsReadyFromPerformanceNow: () => {
    return Promise.resolve(0);
  },
  getUIVisibleFromPerformanceNow: () => {
    return Promise.resolve(0);
  },
  registerDeviceToken: () => {
    return Promise.resolve(true);
  },
};

export default LaunchOptionsManager;
