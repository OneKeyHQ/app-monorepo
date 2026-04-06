/**
 * Bundle Groups Allocation Config (Phase 4)
 *
 * Defines the authoritative mapping from module paths to logical layers.
 * The serializer uses this to:
 * 1. Derive segment runtime ('main' / 'background' / 'shared')
 * 2. Validate startup graphs don't contain forbidden modules
 * 3. Generate allocation reports for CI budget checks
 *
 * Physical products remain two eager entries + lazy segments.
 * The five layers guide what's ALLOWED in the startup graph.
 *
 * Layer hierarchy:
 *   bootstrap.*         — entry points, minimal runtime setup
 *   kernel.shared       — polyfills, RPC protocol, transport (both runtimes)
 *   startup.main        — App shell, first screen, navigation
 *   startup.background  — RPC handler, service locator, DB open
 *   feature.*           — everything else (lazy loaded)
 */

/** @type {'bootstrap.main'|'bootstrap.background'|'kernel.shared'|'startup.main'|'startup.background'|'feature.main'|'feature.background'|'feature.shared'} */

const allocationRules = [
  // ── bootstrap: entry points ──────────────────────────────────────────
  {
    layer: 'bootstrap.main',
    paths: ['apps/mobile/index.ts', 'apps/mobile/jsReady'],
  },
  {
    layer: 'bootstrap.background',
    paths: ['apps/mobile/background.ts'],
  },

  // ── kernel.shared: minimal polyfills, RPC, transport ─────────────────
  {
    layer: 'kernel.shared',
    paths: [
      'packages/shared/src/polyfills/',
      'packages/shared/src/background/',
      'packages/shared/src/eventBus/',
      'packages/shared/src/platformEnv',
      'packages/shared/src/appGlobals',
      'packages/shared/src/errors/',
      'packages/shared/src/performance/',
      'packages/shared/src/storage/',
      'apps/mobile/src/backgroundThread/rpcProtocol',
      'apps/mobile/src/backgroundThread/runtimeReady',
      'apps/mobile/src/splitBundle/',
    ],
  },

  // ── startup.main: App shell, first screen, navigation container ──────
  {
    layer: 'startup.main',
    paths: [
      'apps/mobile/App',
      'apps/mobile/src/backgroundThread/setupMainThreadBackgroundRunner',
      'packages/kit/src/background/instance/backgroundApiProxy',
      'packages/kit/src/background/instance/backgroundApiInit',
      'packages/kit-bg/src/apis/BackgroundApiProxy',
      'packages/kit-bg/src/apis/BackgroundApiProxyBase',
      'packages/kit-bg/src/apis/BackgroundServiceProxyBase',
      'packages/kit-bg/src/apis/IBackgroundApi',
      'packages/kit-bg/src/states/jotai/',
      'packages/components/src/hocs/Provider/',
      'packages/components/src/layouts/',
      'packages/kit/src/components/LazyLoadPage/',
      'packages/kit/src/provider/',
      'packages/kit/src/routes/',
    ],
  },

  // ── startup.background: RPC handler, service locator, DB ─────────────
  {
    layer: 'startup.background',
    paths: [
      'apps/mobile/src/backgroundThread/setupBackgroundThreadRPCHandler',
      'packages/kit-bg/src/apis/BackgroundApi',
      'packages/kit-bg/src/apis/BackgroundApiBase',
      'packages/kit-bg/src/services/ServiceBase',
      'packages/kit-bg/src/services/ServiceBootstrap',
      'packages/kit-bg/src/dbs/local/localDb',
      'packages/kit-bg/src/dbs/local/LocalDbBase',
    ],
  },

  // ── feature.main: UI pages, heavy components ─────────────────────────
  {
    layer: 'feature.main',
    paths: ['packages/kit/src/views/', 'packages/kit/src/components/'],
  },

  // ── feature.background: non-critical background services ─────────────
  {
    layer: 'feature.background',
    paths: [
      'packages/kit-bg/src/services/ServiceNotification',
      'packages/kit-bg/src/services/ServiceCloudBackup',
      'packages/kit-bg/src/services/ServiceContextMenu',
      'packages/kit-bg/src/services/ServiceIpTable',
      'packages/kit-bg/src/services/ServiceWalletConnect',
    ],
  },

  // ── feature.shared: chain SDKs, business logic, vaults ───────────────
  {
    layer: 'feature.shared',
    paths: [
      'packages/kit-bg/src/vaults/',
      'packages/kit-bg/src/services/ServiceSwap',
      'packages/kit-bg/src/services/ServiceHistory',
      'packages/kit-bg/src/services/ServiceToken',
      'packages/kit-bg/src/services/ServiceAccount',
      'packages/kit-bg/src/services/ServiceHardware',
      'packages/kit-bg/src/services/ServiceSetting',
    ],
  },
];

/**
 * Modules that must NEVER appear in the eager startup graph.
 *
 * - Vaults: factory.ts & settings.ts already use import() for lazy loading.
 *   Violations mean a Provider or Service has a sync import of vault impls,
 *   which pulls chain SDKs into eager and slows startup.
 * - Services: BackgroundApi uses getter+require() for lazy instantiation.
 *   Metro still statically collects these, so they appear as violations
 *   even though they are deferred at runtime.
 */
const forbiddenInStartup = [
  'packages/kit-bg/src/vaults/',
  'packages/kit-bg/src/services/ServiceSwap',
  'packages/kit-bg/src/services/ServiceNotification',
  'packages/kit-bg/src/services/ServiceCloudBackup',
  'packages/kit-bg/src/services/ServiceWalletConnect',
  'packages/kit-bg/src/services/ServiceContextMenu',
  'packages/kit-bg/src/services/ServiceIpTable',
];

/**
 * Segment keys to promote (merge into eager entry at build time).
 * Use this for segments that are technically lazy but critical enough
 * to load eagerly. Example: 'seg:kit-bg.services.ServicePassword'
 */
const promotedSegments = [];

module.exports = { allocationRules, forbiddenInStartup, promotedSegments };
