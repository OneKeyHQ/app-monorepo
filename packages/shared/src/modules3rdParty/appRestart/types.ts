/**
 * App-wide restart primitive — replaces direct use of `react-native-restart`.
 *
 * The native module @onekeyfe/react-native-background-thread coordinates the
 * two JS runtimes (main + background) and is the only place that can sequence
 * a reload safely, so we route every restart caller through this wrapper.
 *
 * @see packages/shared/src/modules3rdParty/appRestart/index.native.ts
 * @see node_modules/@onekeyfe/react-native-background-thread/ios/BackgroundThreadManager.mm
 */

export enum EAppRestartMode {
  /**
   * Reload only the main JS runtime (the one driving the UI). The
   * background runtime stays hot, so its in-memory state — open
   * connections, caches, jotai persistence — is preserved.
   *
   * Use for: language change, currency change, Bot account switch,
   * DevSettings, and any other in-app setting that needs the JS tree to
   * re-evaluate but does not change the JS bundle on disk.
   */
  UI = 'ui',
  /**
   * Reload both the main and background JS runtimes. Required whenever
   * the bundle on disk has changed — keeping the two runtimes on
   * mismatched moduleId tables would crash on first cross-runtime
   * require().
   *
   * Use for: OTA bundle install / switch, resetData, and any developer
   * tooling that needs a guaranteed-cold restart.
   */
  All = 'all',
}

export interface IAppRestartOptions {
  mode: EAppRestartMode;
  /**
   * Free-form attribution string. Forwarded to
   * `RCTTriggerReloadCommandListeners` on iOS and to host logs / Sentry
   * breadcrumbs so production restarts are attributable to a feature
   * path. Conventional shape: dotted, lowercase, hierarchical — e.g.
   * `'setting.language'`, `'ota.installBundle'`, `'auth.resetData'`.
   */
  reason: string;
}

export type IAppRestart = (options: IAppRestartOptions) => Promise<void>;
