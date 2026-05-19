import { describe, it, expect } from "vitest";
import vm from "node:vm";
import { BOOTSTRAP_SCRIPT } from "../src/adapters/cdpBootstrap.js";

// Evaluate the bootstrap inside a synthetic sandbox. The bootstrap is an
// IIFE expression, so the last value of `vm.runInContext` is what the IIFE
// returns. We seed the sandbox with `globalThis` aliased to itself so the
// `globalThis.X = ...` assignments land on the context object.
function evalInSandbox(globals: Record<string, unknown>): unknown {
  const ctx: Record<string, unknown> = { ...globals };
  vm.createContext(ctx);
  // Inside the VM, set globalThis to the same context object so reads/writes
  // through `globalThis.X` are observable from the test.
  (ctx as { globalThis?: unknown }).globalThis = ctx;
  return vm.runInContext(BOOTSTRAP_SCRIPT, ctx);
}

describe("CDP bootstrap script", () => {
  it("returns sentinel when no devtools hook", () => {
    const r = evalInSandbox({}) as { error?: string };
    expect(r.error).toBe("no-react-devtools-hook");
  });

  it("returns sentinel when hook has no renderers", () => {
    const r = evalInSandbox({
      __REACT_DEVTOOLS_GLOBAL_HOOK__: { renderers: new Map() },
    }) as { error?: string };
    expect(r.error).toBe("no-react-devtools-hook");
  });

  it("returns sentinel when hook has no fiber roots", () => {
    const r = evalInSandbox({
      __REACT_DEVTOOLS_GLOBAL_HOOK__: {
        renderers: new Map([[1, {}]]),
        getFiberRoots: () => new Set(),
      },
    }) as { error?: string };
    expect(r.error).toBe("no-fiber-roots");
  });

  it("finds jotai store, queryClient, and navigation ref in a fake fiber tree", () => {
    const store = {
      get: () => 0,
      sub: () => () => 0,
    };
    const queryClient = { getQueryCache: () => ({}) };
    const navRef = { current: { navigate: () => {} } };
    const fakeRoot = {
      current: {
        memoizedProps: { store, client: queryClient, ref: navRef },
        child: null,
        sibling: null,
      },
    };
    const hook = {
      renderers: new Map([[1, {}]]),
      getFiberRoots: () => new Set([fakeRoot]),
    };
    const r = evalInSandbox({ __REACT_DEVTOOLS_GLOBAL_HOOK__: hook }) as {
      store?: boolean;
      queryClient?: boolean;
      navigation?: boolean;
      foundAt?: number;
    };
    expect(r.store).toBe(true);
    expect(r.queryClient).toBe(true);
    expect(r.navigation).toBe(true);
    expect(typeof r.foundAt).toBe("number");
  });

  it("walks into child and sibling fibers", () => {
    const store = { get: () => 0, sub: () => () => 0 };
    const queryClient = { getQueryCache: () => ({}) };
    const navRef = { current: { navigate: () => {} } };
    const child = {
      memoizedProps: { ref: navRef },
      child: null,
      sibling: null,
    };
    const sibling = {
      memoizedProps: { client: queryClient },
      child: null,
      sibling: null,
    };
    const fakeRoot = {
      current: {
        memoizedProps: { store },
        child,
        sibling,
      },
    };
    const hook = {
      renderers: new Map([[1, {}]]),
      getFiberRoots: () => new Set([fakeRoot]),
    };
    const r = evalInSandbox({ __REACT_DEVTOOLS_GLOBAL_HOOK__: hook }) as {
      store?: boolean;
      queryClient?: boolean;
      navigation?: boolean;
    };
    expect(r.store).toBe(true);
    expect(r.queryClient).toBe(true);
    expect(r.navigation).toBe(true);
  });

  it("reports reused on second call", () => {
    const ctx: Record<string, unknown> = {
      __onekey_debug__: {
        foundAt: 1,
        store: {},
        queryClient: {},
        navigation: {},
      },
    };
    vm.createContext(ctx);
    (ctx as { globalThis?: unknown }).globalThis = ctx;
    const r = vm.runInContext(BOOTSTRAP_SCRIPT, ctx) as {
      reused?: boolean;
      foundAt?: number;
    };
    expect(r.reused).toBe(true);
    expect(r.foundAt).toBe(1);
  });

  it("re-runs when previous attempt left an error sentinel", () => {
    const ctx: Record<string, unknown> = {
      __onekey_debug__: { error: "no-react-devtools-hook" },
    };
    vm.createContext(ctx);
    (ctx as { globalThis?: unknown }).globalThis = ctx;
    const r = vm.runInContext(BOOTSTRAP_SCRIPT, ctx) as {
      reused?: boolean;
      error?: string;
    };
    // No hook this time either, so it should rewrite the sentinel — not reuse.
    expect(r.reused).toBeUndefined();
    expect(r.error).toBe("no-react-devtools-hook");
  });
});
