// Contract for the subset of `globalThis.desktopApi` fields used by
// platformEnv and other shared code to identify the current desktop
// runtime (platform, arch, store channel, etc.).
//
// There are two writers that must both satisfy this contract:
//   1. `apps/desktop/app/libs/registerInfoHandlers.ts` — provides the IPC
//      payload for the renderer (via preload.ts bridge). Shape matches
//      `IDesktopApiPlatformInfo` (no `isDev`, which travels via a separate
//      IS_DEV IPC).
//   2. `apps/desktop/app/libs/react-native-mock.ts` — populates
//      `globalThis.desktopApi` at module load in the main process bundle
//      (where no preload/IPC layer exists). Shape matches
//      `IDesktopApiGlobal` (includes `isDev`).
//
// `IDesktopApiLegacy` in `./desktop.ts` extends this interface — so any
// field added here is automatically required on the full renderer-facing
// bridge as well, and platformEnv's reads stay type-checked via the
// existing `declare global { var desktopApi: IDesktopApiLegacy }`
// declaration in `@types/globals.d.ts`.

export interface IDesktopApiPlatformInfo {
  platform: string;
  arch: string;
  systemVersion: string;
  channel?: string;
  deskChannel: string;
  isMas: boolean;
  // Epoch ms of the Electron MAIN process creation (`process.getCreationTime()`),
  // the true "app launched" moment. Consumed by the desktop LaunchOptionsManager
  // to anchor cold-start timing (jsReadyTime / uiVisibleTime) on real process
  // spawn — matching the native LaunchOptionsManager — instead of renderer
  // document load. Falls back to `Date.now()` at build time if unavailable.
  processStartAt: number;
}

export interface IDesktopApiGlobal extends IDesktopApiPlatformInfo {
  isDev: boolean;
}
