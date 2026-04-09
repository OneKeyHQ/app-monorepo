/* eslint-disable camelcase */
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { atom, useAtom } from 'jotai';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IContextAtomColdStartCacheKey } from '@onekeyhq/shared/src/consts/jotaiConsts';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
    // Native: read from MMKV per-key if BG thread migration is complete,
    // otherwise fall back to old snapshot blob from onekey-app-setting MMKV.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { default: jotaiMMKV } =
        require('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance');

      let cached: unknown;
      const migrationDone =
        jotaiMMKV.getString(MMKV_MIGRATION_COMPLETE_KEY) === '1';

      if (migrationDone) {
        // Fast path: BG thread has migrated all data to MMKV per-key
        const raw = jotaiMMKV.getString(
          buildJotaiStorageKey(name as IAtomNameKeys),
        );
        if (raw !== undefined && raw !== null) {
          cached = JSON.parse(raw);
        }
      } else {
        // Migration not yet complete — read old snapshot blob as fallback
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { syncStorage: ss } =
          require('@onekeyhq/shared/src/storage/instance/syncStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/syncStorageInstance');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { EAppSyncStorageKeys: sk } =
          require('@onekeyhq/shared/src/storage/syncStorageKeys') as typeof import('@onekeyhq/shared/src/storage/syncStorageKeys');
        // Lazy-parse snapshot blob (cache on globalThis to avoid re-parsing)
        let snapshot = (globalThis as any).__ONEKEY_LEGACY_SNAPSHOT_CACHE__;
        if (snapshot === undefined) {
          const blobRaw = ss.getString(sk.onekey_jotai_atoms_snapshot);
          snapshot = blobRaw ? JSON.parse(blobRaw) : null;
          (globalThis as any).__ONEKEY_LEGACY_SNAPSHOT_CACHE__ = snapshot;
        }
        if (snapshot && name in snapshot) {
          cached = snapshot[name];
        }
      }

      if (cached !== undefined && cached !== null) {
        initialVal = Object.freeze(
          typeof initialValue === 'object' && typeof cached === 'object'
            ? { ...initialValue, ...cached }
            : cached,
        ) as Value & Readonly<Value>;
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

function getTokenSymbolSafe(token: unknown): string {
  if (!token || typeof token !== 'object') {
    return '?';
  }
  const symbol = (token as { symbol?: unknown }).symbol;
  return typeof symbol === 'string' ? symbol : '?';
}

// ============================================================
// Cold Start Cache — automatic value tracking + debounced save
// ============================================================

/** Latest values of all coldStartCache atoms, updated on every use() call */
const coldStartValuesMap = new Map<string, unknown>();

/** Keys that changed since last MMKV flush */
const coldStartDirtyKeys = new Set<string>();

/** Debounce timer for batched MMKV writes */
let coldStartSaveTimer: ReturnType<typeof setTimeout> | undefined;

function flushColdStartCache() {
  if (coldStartDirtyKeys.size === 0) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { coldStartCacheStorage } =
      require('@onekeyhq/shared/src/storage/instance/syncStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/syncStorageInstance');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EAppSyncStorageKeys } =
      require('@onekeyhq/shared/src/storage/syncStorageKeys') as typeof import('@onekeyhq/shared/src/storage/syncStorageKeys');

    const raw = coldStartCacheStorage.getString(
      EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot,
    );
    const snapshot = raw ? JSON.parse(raw) : {};

    for (const name of coldStartDirtyKeys) {
      snapshot[name] = coldStartValuesMap.get(name);
    }

    coldStartCacheStorage.set(
      EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot,
      JSON.stringify(snapshot),
    );
    // DEBUG: log flush details
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { NativeLogger: NL, LogLevel: LL } =
        require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
      const jsEntry: number =
        (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || 0;
      const elapsed = jsEntry ? Date.now() - jsEntry : 0;
      const details = Array.from(coldStartDirtyKeys)
        .map((k) => {
          const v = coldStartValuesMap.get(k);
          if (v && typeof v === 'object' && 'tokens' in (v as any)) {
            const tokens = (v as any).tokens;
            return `${k}(${Array.isArray(tokens) ? tokens.length : '?'}tokens:${
              Array.isArray(tokens)
                ? tokens
                    .slice(0, 3)
                    .map((t: unknown) => getTokenSymbolSafe(t))
                    .join(',')
                : '?'
            })`;
          }
          return k;
        })
        .join(', ');
      NL.write(LL.Info, `[ColdStartCache] flush +${elapsed}ms: ${details}`);
    } catch {
      /* */
    }
    coldStartDirtyKeys.clear();
  } catch {
    /* best-effort */
  }
}

function scheduleColdStartSave(name: string) {
  coldStartDirtyKeys.add(name);
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
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppState } =
      require('react-native') as typeof import('react-native');
    AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        if (coldStartSaveTimer) {
          clearTimeout(coldStartSaveTimer);
          coldStartSaveTimer = undefined;
        }
        flushColdStartCache();
        swrCacheUtils.flushNow();
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
      const cached = getScopedColdStartSnapshotValue({
        snapshot,
        coldStartScopeKey: scope,
        coldStartCacheKey: cacheKey,
      });
      if (cached !== undefined && cached !== null) {
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
        coldStartValuesMap.set(
          buildColdStartScopedKey({
            coldStartScopeKey: scope,
            coldStartCacheKey: cacheKey,
          }),
          nextValue,
        );
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
  name,
  coldStartCache,
  coldStartCacheKey,
}: {
  initialValue: Value;
  name?: string;
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

  const snapshotKey = name;
  const activeColdStartCacheKey =
    coldStartCache && coldStartCacheKey ? coldStartCacheKey : undefined;

  // If named, check context atom snapshot (separate from globalAtom snapshot)
  let resolvedInitialValue = initialValue;
  if (snapshotKey) {
    const ctxSnapshot = (globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__;
    if (ctxSnapshot && snapshotKey in ctxSnapshot) {
      const cached = ctxSnapshot[snapshotKey];
      if (cached !== undefined && cached !== null) {
        resolvedInitialValue =
          typeof initialValue === 'object' && typeof cached === 'object'
            ? { ...initialValue, ...cached }
            : cached;
      }
    }
  }

  const atomBuilder = memoizee(() => atom(resolvedInitialValue));

  // coldStartCache: wrap use() to auto-track value changes
  const wrappedUse = activeColdStartCacheKey
    ? () => {
        const cacheKey = activeColdStartCacheKey;
        const coldStartScopeKey = useColdStartScopeKey?.();
        if (!coldStartScopeKey) {
          throw new OneKeyLocalError(
            `contextAtom coldStartCache requires provider store scope, atom=${cacheKey}`,
          );
        }
        const scopedCacheKey = buildColdStartScopedKey({
          coldStartScopeKey,
          coldStartCacheKey: cacheKey,
        });
        const result = useContextAtom(atomBuilder());
        const currentValue = result[0];
        // DEBUG: log EVERY tokenListAtom render (not just changes)
        if (
          cacheKey === 'ctx:tokenListAtom' &&
          currentValue &&
          typeof currentValue === 'object' &&
          'tokens' in (currentValue as any)
        ) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { NativeLogger: NL, LogLevel: LL } =
              require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
            const tokens = (currentValue as any).tokens;
            const prev = coldStartValuesMap.get(scopedCacheKey);
            const prevTokens =
              prev && typeof prev === 'object' && 'tokens' in (prev as any)
                ? (prev as any).tokens
                : null;
            const changed = prev !== currentValue;
            const jsEntry: number =
              (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || 0;
            const elapsed = jsEntry ? Date.now() - jsEntry : 0;
            NL.write(
              LL.Info,
              `[TokenListUI] +${elapsed}ms render: ${Array.isArray(tokens) ? tokens.length : 0} tokens, first3=[${
                Array.isArray(tokens)
                  ? tokens
                      .slice(0, 3)
                      .map((t: unknown) => getTokenSymbolSafe(t))
                      .join(',')
                  : ''
              }], changed=${changed}, prevFirst3=[${
                Array.isArray(prevTokens)
                  ? prevTokens
                      .slice(0, 3)
                      .map((t: unknown) => getTokenSymbolSafe(t))
                      .join(',')
                  : 'nil'
              }]`,
            );
          } catch {
            /* */
          }
        }
        if (!coldStartValuesMap.has(scopedCacheKey)) {
          coldStartValuesMap.set(scopedCacheKey, currentValue);
          return result;
        }
        if (coldStartValuesMap.get(scopedCacheKey) !== currentValue) {
          coldStartValuesMap.set(scopedCacheKey, currentValue);
          scheduleColdStartSave(scopedCacheKey);
          // Keep existing change log
          if (
            cacheKey === 'ctx:tokenListAtom' &&
            currentValue &&
            typeof currentValue === 'object' &&
            'tokens' in (currentValue as any)
          ) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { NativeLogger: NL, LogLevel: LL } =
                require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
              const tokens = (currentValue as any).tokens;
              const jsEntry: number =
                (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || 0;
              const elapsed = jsEntry ? Date.now() - jsEntry : 0;
              NL.write(
                LL.Info,
                `[TokenListUI] +${elapsed}ms CHANGED → cache updated: ${Array.isArray(tokens) ? tokens.length : '?'} tokens, first3=[${
                  Array.isArray(tokens)
                    ? tokens
                        .slice(0, 3)
                        .map((t: unknown) => getTokenSymbolSafe(t))
                        .join(',')
                    : '?'
                }]`,
              );
            } catch {
              /* */
            }
          }
        }
        return result;
      }
    : () => useContextAtom(atomBuilder());

  const registryKey = activeColdStartCacheKey || snapshotKey;
  if (registryKey) {
    contextAtomSnapshotRegistry.set(registryKey, { atom: atomBuilder });
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
  const atomBuilder = memoizee(() => {
    console.log('create contextAtomComputedBase', Date.now());
    return atom(read);
  });
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
