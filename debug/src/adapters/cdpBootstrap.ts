import type CDP from "chrome-remote-interface";

// The bootstrap script is one self-contained JS expression run via
// Runtime.evaluate. It is idempotent (re-running is cheap) and never throws
// out of the IIFE (errors are captured into the sentinel object).
//
// Walks React DevTools' fiber roots to discover:
//   - a Jotai store        (memoizedProps.store with get + sub)
//   - a TanStack queryClient (memoizedProps.client with getQueryCache)
//   - a React Navigation ref (memoizedProps.ref.current.navigate)
//
// On success: globalThis.__onekey_debug__ = { foundAt, version, store, queryClient, navigation }
// On failure: globalThis.__onekey_debug__ = { error: '<reason>' }
export const BOOTSTRAP_SCRIPT = `(function () {
  try {
    if (globalThis.__onekey_debug__ && !globalThis.__onekey_debug__.error) {
      return { reused: true, foundAt: globalThis.__onekey_debug__.foundAt };
    }
    var hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook || !hook.renderers || !hook.renderers.size) {
      globalThis.__onekey_debug__ = { error: 'no-react-devtools-hook' };
      return globalThis.__onekey_debug__;
    }
    var roots = [];
    hook.renderers.forEach(function (r) {
      var rc = hook.getFiberRoots ? hook.getFiberRoots(r) : null;
      if (rc && typeof rc.forEach === 'function') {
        rc.forEach(function (root) {
          if (root && root.current) roots.push(root.current);
        });
      }
    });
    if (!roots.length) {
      globalThis.__onekey_debug__ = { error: 'no-fiber-roots' };
      return globalThis.__onekey_debug__;
    }
    var found = { store: null, queryClient: null, navigation: null };
    function isJotaiStore(o) {
      return o && typeof o.get === 'function' && typeof o.sub === 'function';
    }
    function isQueryClient(o) {
      return o && typeof o.getQueryCache === 'function';
    }
    function isNavigationRef(o) {
      return o && o.current && typeof o.current.navigate === 'function';
    }
    function visit(fiber, depth) {
      if (!fiber || depth > 200) return;
      var p = fiber.memoizedProps || fiber.pendingProps;
      if (p) {
        if (!found.store && isJotaiStore(p.store)) found.store = p.store;
        if (!found.queryClient && isQueryClient(p.client)) found.queryClient = p.client;
        if (!found.navigation && isNavigationRef(p.ref)) found.navigation = p.ref;
      }
      if (found.store && found.queryClient && found.navigation) return;
      visit(fiber.child, depth + 1);
      visit(fiber.sibling, depth);
    }
    for (var i = 0; i < roots.length; i++) visit(roots[i], 0);
    var rnVersion = (globalThis.process && globalThis.process.versions && globalThis.process.versions['react-native']) || null;
    globalThis.__onekey_debug__ = Object.assign({ foundAt: Date.now(), version: rnVersion }, found);
    return {
      foundAt: globalThis.__onekey_debug__.foundAt,
      store: !!found.store,
      queryClient: !!found.queryClient,
      navigation: !!found.navigation,
      rnVersion: rnVersion,
    };
  } catch (e) {
    globalThis.__onekey_debug__ = { error: 'bootstrap-threw: ' + (e && e.message ? e.message : String(e)) };
    return globalThis.__onekey_debug__;
  }
})()`;

export interface BootstrapReport {
  reused?: boolean;
  error?: string;
  foundAt?: number;
  store?: boolean;
  queryClient?: boolean;
  navigation?: boolean;
  rnVersion?: string | null;
}

/**
 * Inject the bootstrap probe into the attached Hermes/JS runtime. Best-effort:
 * a non-fatal failure surfaces in the returned report (and in the sentinel
 * stored on `globalThis.__onekey_debug__`), which callers can inspect later
 * via `js.eval('__onekey_debug__')`.
 */
export async function injectBootstrap(
  client: CDP.Client,
): Promise<BootstrapReport> {
  const r = (await client.Runtime.evaluate({
    expression: BOOTSTRAP_SCRIPT,
    returnByValue: true,
  })) as {
    result: { value?: BootstrapReport };
    exceptionDetails?: unknown;
  };
  if (r.exceptionDetails) {
    return { error: "evaluate-threw" };
  }
  return r.result.value ?? { error: "no-value" };
}
