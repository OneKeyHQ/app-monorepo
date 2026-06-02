/* eslint-disable camelcase */
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { atom, useAtom } from 'jotai';

import type { IContextAtomColdStartCacheKey } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import {
  parseColdStartSnapshotRaw,
  prepareColdStartSnapshotForWrite,
} from '@onekeyhq/shared/src/utils/coldStartCacheSnapshotUtils';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import {
  MMKV_MIGRATION_COMPLETE_KEY,
  atomWithStorage,
  buildJotaiStorageKey,
  globalJotaiStorageReadyHandler,
} from '../jotaiStorage';

import { JotaiCrossAtom } from './JotaiCrossAtom';
import { wrapAtomPro } from './wrapAtomPro';

import type { EAtomNames, IAtomNameKeys } from '../atomNames';
import type {
  IJotaiAtomProProps,
  IJotaiGetter,
  IJotaiRead,
  IJotaiSetAtom,
  IJotaiSetter,
  IJotaiWithInitialValue,
  IJotaiWritableAtomPro,
  IJotaiWrite,
} from '../types';
import type { Atom, PrimitiveAtom, WritableAtom } from 'jotai';

/** Global registry of atom name → JotaiCrossAtom, populated at module load time.
 *  Used by jotaiInitFromUi to set cached values WITHOUT importing the barrel. */
export const globalAtomRegistry = new Map<string, JotaiCrossAtom<any>>();

export function makeCrossAtom<T extends () => any>(name: string, fn: T) {
  const atomBuilder = memoizee(fn, {
    primitive: true,
    normalizer: () => '',
  });

  const crossAtom = new JotaiCrossAtom(name, atomBuilder);
  // Register named atoms so jotaiInitFromUi can find them without barrel import
  if (name) {
    globalAtomRegistry.set(name, crossAtom);
  }

  return {
    target: crossAtom,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    use: () => useAtom(atomBuilder() as ReturnType<T>),
  };
}

// initialValue
export function crossAtomBuilder<Value>({
  name,
  initialValue,
  read,
  write,
  storageName,
}: {
  name: string;
  initialValue: Value;
  //
  storageName?: IAtomNameKeys;
  read?: undefined;
  write?: undefined;
}): PrimitiveAtom<Value> & IJotaiWithInitialValue<Value>;

// initialValue + storage
export function crossAtomBuilder<Value>({
  name,
  initialValue,
  read,
  write,
  storageName,
}: {
  name: string;
  initialValue: Value;
  storageName: IAtomNameKeys;
  //
  read?: undefined;
  write?: undefined;
}): ReturnType<typeof atomWithStorage<Value>>;

// Read only
export function crossAtomBuilder<Value>({
  name,
  initialValue,
  read,
  write,
  storageName,
}: {
  name: string;
  read: IJotaiRead<Value>;
  //
  initialValue?: Value;
  storageName?: IAtomNameKeys;
  write?: undefined;
}): Atom<Value>;

// WriteOnly
export function crossAtomBuilder<Value, Args extends unknown[], Result>({
  name,
  initialValue,
  read,
  write,
  storageName,
}: {
  name: string;
  write: IJotaiWrite<Args, Result>;
  //
  initialValue?: Value;
  read?: undefined;
  storageName?: IAtomNameKeys;
}): WritableAtom<Value, Args, Result> & IJotaiWithInitialValue<Value>;

// Read & Write
export function crossAtomBuilder<Value, Args extends unknown[], Result>({
  name,
  initialValue,
  read,
  write,
  storageName,
}: {
  name: string;
  read: IJotaiRead<Value, IJotaiSetAtom<Args, Result>>;
  write: IJotaiWrite<Args, Result>;
  //
  initialValue?: Value;
  storageName?: IAtomNameKeys;
}): WritableAtom<Value, Args, Result>;

export function crossAtomBuilder<Value, Args extends unknown[], Result>({
  name,
  initialValue,
  read,
  write,
  storageName,
}: {
  name: string;
  initialValue?: Value;
  storageName?: IAtomNameKeys;
  read?: IJotaiRead<Value, IJotaiSetAtom<Args, Result>> | IJotaiRead<Value>;
  write?: IJotaiWrite<Args, Result>;
}) {
  let a = null;
  let persist = false;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let initialVal = Object.freeze(initialValue!);

  // Hydrate persisted initialValue so the atom starts with the correct value.
  if (platformEnv.isNative && name) {
    // Native: read from MMKV per-key if BG thread migration is complete.
    // If migration not done yet, use default initialValue — BG thread will
    // migrate from AsyncStorage to MMKV per-key, available on next cold start.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { default: jotaiMMKV } =
        require('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance');

      if (jotaiMMKV.getString(MMKV_MIGRATION_COMPLETE_KEY) === '1') {
        const raw = jotaiMMKV.getString(
          buildJotaiStorageKey(name as IAtomNameKeys),
        );
        if (raw !== undefined && raw !== null) {
          const cached = JSON.parse(raw);
          if (cached !== undefined && cached !== null) {
            initialVal = Object.freeze(
              typeof initialValue === 'object' && typeof cached === 'object'
                ? { ...initialValue, ...cached }
                : cached,
            ) as Value & Readonly<Value>;
          }
        }
      }
    } catch {
      /* fallback to default initialValue */
    }
  } else {
    // Non-native: use pre-loaded snapshot from __ONEKEY_JOTAI_INIT_STATES__
    const snapshotStates = (globalThis as any).__ONEKEY_JOTAI_INIT_STATES__;
    if (snapshotStates && name && name in snapshotStates) {
      const cached = snapshotStates[name];
      if (cached !== undefined && cached !== null) {
        initialVal = Object.freeze(
          typeof initialValue === 'object' && typeof cached === 'object'
            ? { ...initialValue, ...cached }
            : cached,
        ) as Value & Readonly<Value>;
      }
    }
  }

  if (typeof write === 'function') {
    if (typeof read === 'function') {
      // read, write
      a = atom(read as IJotaiRead<Value, IJotaiSetAtom<Args, Result>>, write);
    } else {
      // initialValue, write
      a = atom(initialVal, write);
    }
  } else if (typeof read === 'function') {
    // read
    a = atom(read as IJotaiRead<Value>);
  } else if (storageName && typeof storageName === 'string') {
    // storage
    a = atomWithStorage(storageName, initialVal);
    persist = true;
  } else {
    // initialValue
    a = atom(initialVal);
  }

  const baseAtom = a as IJotaiWritableAtomPro<
    unknown,
    [update: unknown],
    Promise<void> | undefined
  >;
  baseAtom.initialValue = initialVal;
  const proAtom = wrapAtomPro(name as EAtomNames, baseAtom);
  proAtom.storageReady = globalJotaiStorageReadyHandler.ready;
  proAtom.initialValue = initialVal;
  proAtom.persist = persist;
  proAtom.$$isGlobalAtom = true;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return proAtom as unknown as any;
}

/*
(read: Read<Value, SetAtom<Args, Result>>, write: Write<Args, Result>): WritableAtom<Value, Args, Result>;

(read: Read<Value>): Atom<Value>;

(initialValue: Value, write: Write<Args, Result>): WritableAtom<Value, Args, Result> & WithInitialValue<Value>;

(initialValue: Value): PrimitiveAtom<Value> & WithInitialValue<Value>;
export {};
*/

export function globalAtom<Value>({
  initialValue,
  name,
  persist,
}: {
  name: EAtomNames;
  initialValue: Value;
  persist?: boolean;
}) {
  const storageName = persist ? name : undefined;
  return makeCrossAtom(name, () =>
    crossAtomBuilder({
      name,
      initialValue,
      storageName,
    }),
  );
}

// TODO TS issue fix
export function globalAtomComputedAll<Value, Args extends unknown[], Result>({
  read,
  write,
}: {
  read?: IJotaiRead<Value, IJotaiSetAtom<Args, Result>> | IJotaiRead<Value>;
  write?: IJotaiWrite<Args, Result>;
}) {
  if (typeof write === 'function' && typeof read === 'function') {
    // Read & Write
    return makeCrossAtom('', () =>
      crossAtomBuilder({
        name: '',
        read: read as IJotaiRead<Value, IJotaiSetAtom<Args, Result>>,
        write,
      }),
    );
  }
  if (typeof write === 'function') {
    // Write
    return makeCrossAtom('', () =>
      crossAtomBuilder({
        name: '',
        write,
      }),
    );
  }
  if (typeof read === 'function') {
    // Read
    return makeCrossAtom('', () =>
      crossAtomBuilder({
        name: '',
        read: read as IJotaiRead<Value>,
      }),
    );
  }
  throw new OneKeyLocalError('write or read is missing');
}

export function globalAtomComputedRW<Value, Args extends unknown[], Result>({
  read,
  write,
}: {
  read: IJotaiRead<Value, IJotaiSetAtom<Args, Result>>;
  write: IJotaiWrite<Args, Result>;
}) {
  // Read & Write
  return makeCrossAtom('', () =>
    crossAtomBuilder({
      name: '',
      read,
      write,
    }),
  );
}

export function globalAtomComputedR<Value>({
  read,
}: {
  read: IJotaiRead<Value>;
}) {
  // Read
  return makeCrossAtom('', () =>
    crossAtomBuilder({
      name: '',
      read,
    }),
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalAtomComputedW<Value, Args extends unknown[], Result>({
  write,
}: {
  write: IJotaiWrite<Args, Result>;
}) {
  // Write
  return makeCrossAtom('', () =>
    crossAtomBuilder({
      name: '',
      write,
    }),
  );
}

export function globalAtomComputed<Value>(read: IJotaiRead<Value>) {
  // Read
  return globalAtomComputedR({ read });
}

/**
 * Registry of named contextAtoms for MMKV snapshot save/restore.
 * Unlike globalAtomRegistry (for globalAtoms), this tracks contextAtom
 * name→atomBuilder mappings so snapshot injection can work.
 */
export const contextAtomSnapshotRegistry = new Map<
  string,
  { atom: () => any }
>();

const COLD_START_SCOPED_KEY_SEPARATOR = '::';
const hydratedColdStartScopesByStore = new WeakMap<object, Set<string>>();

function buildColdStartScopedKey({
  coldStartScopeKey,
  coldStartCacheKey,
}: {
  coldStartScopeKey: string;
  coldStartCacheKey: IContextAtomColdStartCacheKey;
}) {
  return `${coldStartScopeKey}${COLD_START_SCOPED_KEY_SEPARATOR}${coldStartCacheKey}`;
}

function getScopedColdStartSnapshotValue({
  snapshot,
  coldStartScopeKey,
  coldStartCacheKey,
}: {
  snapshot: Record<string, unknown>;
  coldStartScopeKey: string;
  coldStartCacheKey: IContextAtomColdStartCacheKey;
}) {
  const scopedKey = buildColdStartScopedKey({
    coldStartScopeKey,
    coldStartCacheKey,
  });
  if (scopedKey in snapshot) {
    return snapshot[scopedKey];
  }
  return undefined;
}

// ============================================================
// Jotai Cold Start SSR — Phase 3: Value Tracking + Debounced Save
//
// Tracks atom value changes at runtime and debounce-writes them to
// MMKV so the next cold start can hydrate from fresh data.
// This is the "server render" side — generating the snapshot that
// Phase 1 (index.ts pre-read) and Phase 2 (hydration below) consume.
// ============================================================

/** Latest values of all coldStartCache atoms, updated on every use() call */
const coldStartValuesMap = new Map<string, unknown>();

/** Keys that changed since last MMKV flush */
function coldStartLog(msg: string) {
  try {
    NativeLogger.write(LogLevel.Info, `[ColdStartCache] ${msg}`);
  } catch {
    /* noop */
  }
}

const coldStartDirtyKeys = new Set<string>();

/** Debounce timer for batched MMKV writes */
let coldStartSaveTimer: ReturnType<typeof setTimeout> | undefined;

function flushColdStartCache() {
  if (coldStartDirtyKeys.size === 0) return;
  coldStartLog(
    `flush: ${coldStartDirtyKeys.size} dirty keys: ${[...coldStartDirtyKeys].join(', ')}`,
  );
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { coldStartCacheStorage } =
      require('@onekeyhq/shared/src/storage/instance/syncStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/syncStorageInstance');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EAppSyncStorageKeys } =
      require('@onekeyhq/shared/src/storage/syncStorageKeys') as typeof import('@onekeyhq/shared/src/storage/syncStorageKeys');

    // Read-modify-write: patch only dirty keys into existing snapshot.
    // This preserves cached values for scopes not rendered this session.
    // Safe because all callers (debounce timer + AppState) are on main thread.
    const raw = coldStartCacheStorage.getString(
      EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot,
    );
    const snapshot = parseColdStartSnapshotRaw(raw) ?? {};

    for (const name of coldStartDirtyKeys) {
      snapshot[name] = coldStartValuesMap.get(name);
    }

    const preparedSnapshot = prepareColdStartSnapshotForWrite(snapshot);
    if (preparedSnapshot.droppedKeys.length > 0) {
      coldStartLog(
        `drop oversized keys: ${preparedSnapshot.droppedKeys.join(', ')}`,
      );
    }

    coldStartCacheStorage.set(
      EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot,
      preparedSnapshot.serialized,
    );
    coldStartDirtyKeys.clear();
  } catch {
    /* best-effort */
  }
}

function flushColdStartCachesNow() {
  if (coldStartSaveTimer) {
    clearTimeout(coldStartSaveTimer);
    coldStartSaveTimer = undefined;
  }
  flushColdStartCache();
  swrCacheUtils.flushNow();
}

let coldStartDesktopUnloadListenerRegistered = false;
export function ensureColdStartDesktopUnloadListener() {
  if (coldStartDesktopUnloadListenerRegistered || !platformEnv.isDesktop) {
    return;
  }
  coldStartDesktopUnloadListenerRegistered = true;

  const win =
    typeof globalThis.window !== 'undefined'
      ? (globalThis.window as Pick<Window, 'addEventListener'>)
      : undefined;
  win?.addEventListener?.('beforeunload', flushColdStartCachesNow);

  const doc =
    typeof globalThis.document !== 'undefined'
      ? (globalThis.document as Pick<
          Document,
          'addEventListener' | 'visibilityState'
        >)
      : undefined;
  doc?.addEventListener?.('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') {
      flushColdStartCachesNow();
    }
  });
}

function scheduleColdStartSave(name: string) {
  coldStartDirtyKeys.add(name);
  coldStartLog(`scheduleSave: ${name}, dirty=${coldStartDirtyKeys.size}`);
  // Restart timer on each change so we save the FINAL value, not an
  // intermediate one (e.g., All Networks token list arrives progressively).
  if (coldStartSaveTimer) {
    clearTimeout(coldStartSaveTimer);
  }
  coldStartSaveTimer = setTimeout(() => {
    coldStartSaveTimer = undefined;
    flushColdStartCache();
  }, 2000);
}

let coldStartAppStateListenerRegistered = false;
function ensureColdStartAppStateListener() {
  if (coldStartAppStateListenerRegistered) return;
  coldStartAppStateListenerRegistered = true;
  ensureColdStartDesktopUnloadListener();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppState } =
      require('react-native') as typeof import('react-native');
    AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        flushColdStartCachesNow();
      }
    });
  } catch {
    /* AppState not available in non-RN env */
  }
}

export function hydrateContextColdStartCacheForProvider({
  store,
  coldStartScopeKey,
}: {
  store: {
    get: (atomInstance: unknown) => unknown;
    set: (atomInstance: unknown, value: unknown) => void;
  };
  coldStartScopeKey: string;
}) {
  const scope = coldStartScopeKey;
  let scopeSet = hydratedColdStartScopesByStore.get(store as object);
  if (!scopeSet) {
    scopeSet = new Set<string>();
    hydratedColdStartScopesByStore.set(store as object, scopeSet);
  }
  if (scopeSet.has(scope)) {
    return;
  }
  scopeSet.add(scope);

  try {
    const snapshot = (globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__ as
      | Record<string, unknown>
      | undefined;
    if (!snapshot) {
      return;
    }

    for (const [
      cacheKey,
      { atom: atomBuilder },
    ] of contextAtomSnapshotRegistry) {
      const typedCacheKey = cacheKey as IContextAtomColdStartCacheKey;
      const cached = getScopedColdStartSnapshotValue({
        snapshot,
        coldStartScopeKey: scope,
        coldStartCacheKey: typedCacheKey,
      });
      if (cached !== undefined && cached !== null) {
        const scopedCacheKey = buildColdStartScopedKey({
          coldStartScopeKey: scope,
          coldStartCacheKey: typedCacheKey,
        });
        const atomInstance = atomBuilder();
        const currentValue = store.get(atomInstance);
        const nextValue =
          typeof currentValue === 'object' &&
          currentValue !== null &&
          typeof cached === 'object' &&
          cached !== null
            ? { ...(currentValue as any), ...(cached as any) }
            : cached;

        store.set(atomInstance, nextValue);
        coldStartValuesMap.set(scopedCacheKey, nextValue);
        coldStartLog(`hydrate: ${scopedCacheKey}`);
      }
    }
    // Schedule snapshot cleanup after first screen renders (HomePageReady).
    // Cannot use setTimeout(0) because split-bundle modules may still need
    // the snapshot for contextAtomBase hydration after async segment loads.
    if (!(globalThis as any).__ONEKEY_CTX_SNAPSHOT_CLEANUP_SCHEDULED__) {
      (globalThis as any).__ONEKEY_CTX_SNAPSHOT_CLEANUP_SCHEDULED__ = true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { EAppEventBusNames: busNames, appEventBus: bus } =
          require('@onekeyhq/shared/src/eventBus/appEventBus') as typeof import('@onekeyhq/shared/src/eventBus/appEventBus');
        bus.once(busNames.HomePageReady, () => {
          delete (globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__;
          delete (globalThis as any).__ONEKEY_CTX_SNAPSHOT_CLEANUP_SCHEDULED__;
        });
      } catch {
        // Fallback: clean up after 10s if event bus unavailable
        setTimeout(() => {
          delete (globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__;
        }, 10_000);
      }
    }
  } catch {
    /* best-effort */
  }
}

// ============================================================

export function contextAtomBase<Value>({
  initialValue,
  useContextAtom,
  useColdStartScopeKey,
  coldStartCache,
  coldStartCacheKey,
}: {
  initialValue: Value;
  coldStartCache?: boolean;
  coldStartCacheKey?: IContextAtomColdStartCacheKey;
  useColdStartScopeKey?: () => string | undefined;
  useContextAtom: <Value2, Args extends any[], Result>(
    atomInstance: WritableAtom<Value2, Args, Result>,
  ) => [Awaited<Value2>, IJotaiSetAtom<Args, Result>];
}) {
  if (coldStartCache && !coldStartCacheKey) {
    throw new OneKeyLocalError(
      'contextAtom coldStartCache requires explicit coldStartCacheKey',
    );
  }

  const activeColdStartCacheKey =
    coldStartCache && coldStartCacheKey ? coldStartCacheKey : undefined;

  // Hydration of context atoms is scoped (per-provider store) and happens in
  // hydrateContextColdStartCacheForProvider, keyed by
  // `${coldStartScopeKey}::${coldStartCacheKey}`. Module-load-time hydration
  // via a bare atom name would never match those scoped keys and therefore
  // does not apply to contextAtoms.
  const atomBuilder = memoizee(() => atom(initialValue));

  // coldStartCache: wrap use() to auto-track value changes
  const wrappedUse = activeColdStartCacheKey
    ? () => {
        const cacheKey = activeColdStartCacheKey;
        const coldStartScopeKey = useColdStartScopeKey?.();
        const result = useContextAtom(atomBuilder());
        // Missing scopeKey means the atom is being consumed from a store not
        // created via JotaiContextStore.createStore (e.g. a test harness or a
        // future embedded renderer). Fall back to plain useContextAtom and
        // skip cold-start tracking rather than crashing the render tree.
        if (!coldStartScopeKey) {
          coldStartLog(`no-scope-key: ${cacheKey}`);
          return result;
        }
        const scopedCacheKey = buildColdStartScopedKey({
          coldStartScopeKey,
          coldStartCacheKey: cacheKey,
        });
        const currentValue = result[0];
        if (!coldStartValuesMap.has(scopedCacheKey)) {
          coldStartValuesMap.set(scopedCacheKey, currentValue);
          coldStartLog(`init: ${scopedCacheKey}`);
          return result;
        }
        if (coldStartValuesMap.get(scopedCacheKey) !== currentValue) {
          coldStartValuesMap.set(scopedCacheKey, currentValue);
          coldStartLog(`changed: ${scopedCacheKey}`);
          scheduleColdStartSave(scopedCacheKey);
        }
        return result;
      }
    : () => useContextAtom(atomBuilder());

  if (activeColdStartCacheKey) {
    contextAtomSnapshotRegistry.set(activeColdStartCacheKey, {
      atom: atomBuilder,
    });
  }

  if (activeColdStartCacheKey) {
    ensureColdStartAppStateListener();
  }

  return {
    useContextAtom,
    atom: atomBuilder,
    use: wrappedUse,
  };
}

export function contextAtomComputedBase<Value>({
  read,
  useContextAtom,
}: {
  read: IJotaiRead<Value>;
  useContextAtom: <Value2>(atomInstance: Atom<Value2>) => [Awaited<Value2>];
}) {
  const atomBuilder = memoizee(() => atom(read));
  const useFn = () => {
    const r = useContextAtom(atomBuilder());
    return r;
  };

  return {
    atom: atomBuilder,
    use: useFn,
  };
}

function globalAtomInContextError<Value>(
  atomInstance: IJotaiAtomProProps<Value>,
) {
  throw new OneKeyLocalError(
    `${atomInstance.name}:::globalAtom cannot be used in context method by get(globalAtom()) or set(globalAtom()), you should use like await globalAtom.get() or await globalAtom.set(...args) instead.`,
  );
}

function contextAtomCustomFn<Value, Args extends unknown[], Result>(
  fn: IJotaiWrite<Args, Result>,
) {
  return (get: IJotaiGetter, set: IJotaiSetter, ...args: Args) => {
    const getNew: IJotaiGetter = ((atomInstance: Atom<Value>) => {
      if (
        (atomInstance as unknown as IJotaiAtomProProps<Value>)
          ?.$$isGlobalAtom === true
      ) {
        globalAtomInContextError(atomInstance as any);
      }
      return get(atomInstance);
    }) as IJotaiGetter;
    const setNew: IJotaiSetter = ((
      atomInstance: WritableAtom<Value, Args, Result>,
      ...args2: Args
    ) => {
      if (
        (atomInstance as unknown as IJotaiAtomProProps<Value>)
          ?.$$isGlobalAtom === true
      ) {
        globalAtomInContextError(atomInstance as any);
      }
      return set(atomInstance, ...args2);
    }) as IJotaiSetter;
    return fn(getNew, setNew, ...args);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function contextAtomMethodBase<Value, Args extends unknown[], Result>({
  fn,
  useContextAtom,
}: {
  fn: IJotaiWrite<Args, Result>;
  useContextAtom: <Value2, Args2 extends any[], Result2>(
    atomInstance: WritableAtom<Value2, Args2, Result2>,
  ) => [Awaited<Value2>, IJotaiSetAtom<Args2, Result2>];
}) {
  const atomBuilder = memoizee(() => atom(null, contextAtomCustomFn(fn)));
  const useFn = () => {
    const [, setter] = useContextAtom(atomBuilder());
    return setter;
  };

  const call = (set: IJotaiSetter, ...args: Args) =>
    set(atomBuilder(), ...args);

  return {
    atom: atomBuilder,
    use: useFn,
    call,
  };
}
