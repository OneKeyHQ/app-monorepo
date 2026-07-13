import requestHelper from '@onekeyhq/shared/src/request/requestHelper';

/**
 * Installs getIpTableConfig with lazy simpleDb import.
 *
 * MUST be in a separate file from updateInterceptorRequestHelper so that
 * `import('simpleDb')` is never traced by Metro when the main thread
 * imports updateInterceptorRequestHelper. Metro traces all code in a
 * module, not just the imported export.
 *
 * Called by:
 * - BackgroundApiBase.ts (background thread on all platforms)
 * - kit/src/index.tsx on non-split-thread platforms (desktop, web, ext)
 */
export function updateInterceptorRequestHelperWithIpTable() {
  requestHelper.getIpTableConfig = async () => {
    const { default: simpleDb } =
      await import('@onekeyhq/kit-bg/src/dbs/simple/simpleDb');
    if (!simpleDb) {
      return null;
    }
    return simpleDb.ipTable.getConfig();
  };
}
