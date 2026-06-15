// cspell:ignore lockdown Lockdown

import { OneKeyLocalError } from '../../errors';

import { getConfiguredSesHardenLevel } from './config';
import { getSesLockdownOptions } from './options';

import type {
  ISesHardenGlobal,
  ISesHardenLevel,
  ISesHardenPatchWarning,
  ISesHardenPatchWarningKind,
  ISesHardenRuntime,
  ISesHardenRuntimeState,
} from './types';
import type { Harden, LockdownOptions } from 'ses';

export const SES_HARDEN_LEVEL_STORAGE_KEY = 'ONEKEY_SES_HARDEN_LEVEL';
export const SES_HARDEN_LEVEL_QUERY_KEY = 'onekeySesHardenLevel';
export const SES_HARDEN_LEVEL_QUERY_KEY_SHORT = 'sesHardenLevel';
export const SES_HARDEN_LEVEL_ENV_KEY = 'ONEKEY_SES_HARDEN_LEVEL';
export const SES_HARDEN_PATCH_WARNING_LIMIT = 20;

const SES_HARDEN_LEVELS = new Set<ISesHardenLevel>(['L0', 'L1', 'L2']);
const SES_HARDEN_PATCH_ERROR_PATTERNS = [
  /Cannot assign to read only property/iu,
  /Attempted to assign to readonly property/iu,
  /Cannot add property .*object is not extensible/iu,
  /object is not extensible/iu,
  /Cannot define property/iu,
  /Cannot redefine property/iu,
  /Cannot delete property/iu,
  /Cannot set property .* which has only a getter/iu,
];

let appliedState: ISesHardenRuntimeState | undefined;

function getSesGlobal(): ISesHardenGlobal {
  return globalThis as unknown as ISesHardenGlobal;
}

export function normalizeSesHardenLevel(
  value: unknown,
): ISesHardenLevel | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  return SES_HARDEN_LEVELS.has(normalized as ISesHardenLevel)
    ? (normalized as ISesHardenLevel)
    : undefined;
}

function getLevelFromUrl(): ISesHardenLevel | undefined {
  const { location } = getSesGlobal();
  const search = location?.search;
  if (!search) {
    return undefined;
  }

  try {
    const params = new URLSearchParams(search);
    return (
      normalizeSesHardenLevel(params.get(SES_HARDEN_LEVEL_QUERY_KEY)) ??
      normalizeSesHardenLevel(params.get(SES_HARDEN_LEVEL_QUERY_KEY_SHORT))
    );
  } catch {
    return undefined;
  }
}

function getLevelFromStorage(): ISesHardenLevel | undefined {
  const { localStorage } = getSesGlobal();
  try {
    return normalizeSesHardenLevel(
      localStorage?.getItem(SES_HARDEN_LEVEL_STORAGE_KEY),
    );
  } catch {
    return undefined;
  }
}

function getLevelFromProcessEnv(): ISesHardenLevel | undefined {
  if (typeof process === 'undefined') {
    return undefined;
  }

  return normalizeSesHardenLevel(
    process.env?.[SES_HARDEN_LEVEL_ENV_KEY] ??
      process.env?.ONEKEY_APP_SES_HARDEN_LEVEL,
  );
}

export function getSesHardenLevelFromRuntime(
  runtime?: ISesHardenRuntime,
): ISesHardenLevel {
  const globalLevel = getSesGlobal().__ONEKEY_SES_HARDEN_LEVEL__;

  return (
    getLevelFromUrl() ??
    normalizeSesHardenLevel(globalLevel) ??
    getLevelFromStorage() ??
    getLevelFromProcessEnv() ??
    getConfiguredSesHardenLevel(runtime)
  );
}

function setSesHardenRuntimeState(state: ISesHardenRuntimeState): void {
  const g = getSesGlobal();
  appliedState = state;
  try {
    g.__ONEKEY_SES_HARDEN_STATE__ = state;
  } catch {
    // Best-effort diagnostic state only.
  }
}

function getStringProperty(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const property = (value as Record<string, unknown>)[key];
  return typeof property === 'string' ? property : undefined;
}

function getNumberProperty(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const property = (value as Record<string, unknown>)[key];
  return typeof property === 'number' ? property : undefined;
}

function getPatchErrorMessage(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  return getStringProperty(value, 'message');
}

function getPatchErrorStack(value: unknown): string | undefined {
  return getStringProperty(value, 'stack');
}

export function isSesHardenPatchWarningMonitorEnabled(): boolean {
  if (typeof process === 'undefined') {
    return true;
  }

  return process.env?.NODE_ENV !== 'production';
}

function isLikelyPostLockdownPatchError(value: unknown): boolean {
  const message = getPatchErrorMessage(value);
  if (!message) {
    return false;
  }

  return SES_HARDEN_PATCH_ERROR_PATTERNS.some((pattern) =>
    pattern.test(message),
  );
}

function getOrCreatePatchWarnings(): ISesHardenPatchWarning[] {
  const g = getSesGlobal();
  if (g.__ONEKEY_SES_HARDEN_PATCH_WARNINGS__) {
    return g.__ONEKEY_SES_HARDEN_PATCH_WARNINGS__;
  }

  const warnings: ISesHardenPatchWarning[] = [];
  try {
    g.__ONEKEY_SES_HARDEN_PATCH_WARNINGS__ = warnings;
  } catch {
    // Best-effort diagnostics only.
  }
  return warnings;
}

function getPatchWarningStackFrame(value: unknown): string | undefined {
  return getPatchErrorStack(value)
    ?.split('\n')
    .map((line) => line.trim())
    .find(Boolean);
}

function getPatchWarningFingerprint(
  kind: ISesHardenPatchWarningKind,
  value: unknown,
  event?: Event,
): string {
  return [
    kind,
    getPatchErrorMessage(value) ?? String(value),
    getStringProperty(event, 'filename') ?? getPatchWarningStackFrame(value),
  ]
    .filter(Boolean)
    .join('|');
}

function recordSesHardenPatchWarning(
  state: ISesHardenRuntimeState,
  kind: ISesHardenPatchWarningKind,
  value: unknown,
  event?: Event,
): void {
  if (!isLikelyPostLockdownPatchError(value)) {
    return;
  }

  const g = getSesGlobal();
  const warnings = getOrCreatePatchWarnings();
  const count = (g.__ONEKEY_SES_HARDEN_PATCH_WARNING_COUNT__ ?? 0) + 1;
  const now = new Date().toISOString();
  const fingerprint = getPatchWarningFingerprint(kind, value, event);
  const existingIndex = warnings.findIndex(
    (item) => item.fingerprint === fingerprint,
  );
  let warning: ISesHardenPatchWarning;

  if (existingIndex >= 0) {
    const existingWarning = warnings[existingIndex];
    warning = {
      ...existingWarning,
      lastSeenAt: now,
      count: existingWarning.count + 1,
      stack: getPatchErrorStack(value) ?? existingWarning.stack,
      source: getStringProperty(event, 'filename') ?? existingWarning.source,
      lineno: getNumberProperty(event, 'lineno') ?? existingWarning.lineno,
      colno: getNumberProperty(event, 'colno') ?? existingWarning.colno,
    };
    warnings.splice(existingIndex, 1);
  } else {
    warning = {
      id: count,
      createdAt: now,
      lastSeenAt: now,
      level: state.level,
      runtime: state.runtime,
      kind,
      fingerprint,
      count: 1,
      message: getPatchErrorMessage(value) ?? String(value),
      stack: getPatchErrorStack(value),
      source: getStringProperty(event, 'filename'),
      lineno: getNumberProperty(event, 'lineno'),
      colno: getNumberProperty(event, 'colno'),
    };
  }

  try {
    g.__ONEKEY_SES_HARDEN_PATCH_WARNING_COUNT__ = count;
    warnings.push(warning);
    if (warnings.length > SES_HARDEN_PATCH_WARNING_LIMIT) {
      warnings.splice(0, warnings.length - SES_HARDEN_PATCH_WARNING_LIMIT);
    }
  } catch {
    // Best-effort diagnostics only.
  }

  // Keep this visible in dev builds so engineers can decide whether the patch
  // belongs before lockdown or indicates unexpected tampering.
  console.warn('[OneKey SES Harden] Post-lockdown patch attempt detected', {
    warning,
  });
}

function installSesHardenPatchWarningMonitor(
  state: ISesHardenRuntimeState,
): void {
  if (
    !isSesHardenPatchWarningMonitorEnabled() ||
    !state.lockdownApplied ||
    state.level === 'L0'
  ) {
    return;
  }

  const g = getSesGlobal();
  if (
    g.__ONEKEY_SES_HARDEN_PATCH_WARNING_MONITOR_INSTALLED__ ||
    typeof g.addEventListener !== 'function'
  ) {
    return;
  }

  try {
    g.__ONEKEY_SES_HARDEN_PATCH_WARNING_MONITOR_INSTALLED__ = true;
    getOrCreatePatchWarnings();

    g.addEventListener('error', (event) => {
      const errorValue = event.error ?? getStringProperty(event, 'message');
      recordSesHardenPatchWarning(state, 'error', errorValue, event);
    });

    g.addEventListener('unhandledrejection', (event) => {
      recordSesHardenPatchWarning(
        state,
        'unhandledrejection',
        event.reason,
        event,
      );
    });
  } catch {
    // Diagnostics must never affect app startup.
  }
}

export function getSesHardenPatchWarnings(): readonly ISesHardenPatchWarning[] {
  return [...(getSesGlobal().__ONEKEY_SES_HARDEN_PATCH_WARNINGS__ ?? [])];
}

export function installSesHardenRuntimeSwitch(): void {
  const g = getSesGlobal();
  if (typeof g.__ONEKEY_SET_SES_HARDEN_LEVEL__ === 'function') {
    return;
  }

  try {
    Object.defineProperty(g, '__ONEKEY_SET_SES_HARDEN_LEVEL__', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: (level?: ISesHardenLevel | null) => {
        const normalized = normalizeSesHardenLevel(level);
        if (normalized) {
          try {
            g.localStorage?.setItem(SES_HARDEN_LEVEL_STORAGE_KEY, normalized);
          } catch {
            g.__ONEKEY_SES_HARDEN_LEVEL__ = normalized;
          }
        } else {
          try {
            g.localStorage?.removeItem(SES_HARDEN_LEVEL_STORAGE_KEY);
          } catch {
            g.__ONEKEY_SES_HARDEN_LEVEL__ = getConfiguredSesHardenLevel();
          }
        }

        g.location?.reload();
      },
    });
  } catch {
    // Runtime switching is a convenience helper; lockdown behavior must not
    // depend on whether this global can be installed.
  }
}

function defaultLoadSes(): void {
  // Loading SES installs globalThis.lockdown synchronously. Keep it out of the
  // module top level so L0 remains a true no-lockdown path.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('ses');
}

function getLockdownAfterLoad(
  loadSes: () => void,
): NonNullable<ISesHardenGlobal['lockdown']> {
  const g = getSesGlobal();
  if (typeof g.lockdown !== 'function') {
    loadSes();
  }

  if (typeof g.lockdown !== 'function') {
    throw new OneKeyLocalError(
      'SES lockdown() is not available after loading ses.',
    );
  }

  return g.lockdown;
}

function getSesHardenFromGlobal(): Harden | undefined {
  return getSesGlobal().harden;
}

export function getSesHarden(): Harden | undefined {
  return getSesHardenFromGlobal();
}

export function maybeLockdownOneKeyRuntime(options: {
  runtime: ISesHardenRuntime;
  level?: ISesHardenLevel;
  loadSes?: () => void;
  lockdown?: (lockdownOptions?: LockdownOptions) => void;
  installSwitch?: boolean;
}): ISesHardenRuntimeState {
  if (options.installSwitch !== false) {
    installSesHardenRuntimeSwitch();
  }

  const level = options.level ?? getSesHardenLevelFromRuntime(options.runtime);
  const lockdownOptions = getSesLockdownOptions(level);

  if (level === 'L0') {
    const state: ISesHardenRuntimeState = {
      level,
      runtime: options.runtime,
      lockdownApplied: false,
      objectPrototypeFrozen: Object.isFrozen(Object.prototype),
      reason: 'level-disabled',
    };
    setSesHardenRuntimeState(state);
    installSesHardenPatchWarningMonitor(state);
    return state;
  }

  if (appliedState?.lockdownApplied) {
    const state: ISesHardenRuntimeState = {
      ...appliedState,
      reason: 'already-applied',
    };
    installSesHardenPatchWarningMonitor(state);
    return state;
  }

  if (
    typeof getSesHardenFromGlobal() === 'function' &&
    Object.isFrozen(Object.prototype)
  ) {
    const state: ISesHardenRuntimeState = {
      level,
      runtime: options.runtime,
      lockdownApplied: true,
      evalTaming: lockdownOptions?.evalTaming,
      objectPrototypeFrozen: true,
      reason: 'already-locked-down',
    };
    setSesHardenRuntimeState(state);
    installSesHardenPatchWarningMonitor(state);
    return state;
  }

  const lockdown =
    options.lockdown ?? getLockdownAfterLoad(options.loadSes ?? defaultLoadSes);

  lockdown(lockdownOptions);

  const state: ISesHardenRuntimeState = {
    level,
    runtime: options.runtime,
    lockdownApplied: true,
    evalTaming: lockdownOptions?.evalTaming,
    objectPrototypeFrozen: Object.isFrozen(Object.prototype),
  };
  setSesHardenRuntimeState(state);
  installSesHardenPatchWarningMonitor(state);
  return state;
}

export function resetSesHardenRuntimeStateForTest(): void {
  appliedState = undefined;
  const g = getSesGlobal();
  try {
    delete g.__ONEKEY_SES_HARDEN_STATE__;
    delete g.__ONEKEY_SES_HARDEN_PATCH_WARNINGS__;
    delete g.__ONEKEY_SES_HARDEN_PATCH_WARNING_COUNT__;
    delete g.__ONEKEY_SES_HARDEN_PATCH_WARNING_MONITOR_INSTALLED__;
  } catch {
    // ignore
  }
}
