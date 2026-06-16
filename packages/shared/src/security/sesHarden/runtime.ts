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

export const SES_HARDEN_PATCH_WARNING_LIMIT = 20;
// Cap the emitted-fingerprint set so a pathological stream of unique
// post-lockdown patch errors can never grow it without bound. Once the cap is
// reached we stop tracking new fingerprints (and therefore stop emitting brand
// new ones) instead of evicting, keeping the dedup guarantee deterministic.
export const SES_HARDEN_PATCH_WARNING_EMIT_FINGERPRINT_LIMIT = 100;

// Fingerprints we have already emitted (console.warn) during this session.
// Recording into the in-memory warnings array is always deduped by fingerprint,
// but emission must also be deduped so a repeated identical patch error cannot
// spam the console / any downstream log sink with the same entry every time it
// fires. This lives at module scope so it is shared across calls within the
// same JS runtime (main / bg / each ext context keep their own copy, matching
// the per-runtime JS-heap model).
const sesHardenEmittedWarningFingerprints = new Set<string>();

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

export function getSesHardenLevelFromRuntime(
  runtime?: ISesHardenRuntime,
): ISesHardenLevel {
  return getConfiguredSesHardenLevel(runtime);
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
  // The monitor is install-once (two passive addEventListener registrations)
  // plus an only-on-violation callback: it fires solely on uncaught `error` /
  // `unhandledrejection` events, never on any hot/per-operation path, and the
  // callback bails out immediately via a cheap regex check when the error is
  // not a post-lockdown patch attempt. That makes it safe to keep enabled in
  // production so we retain diagnostics there. Emission to the console is
  // additionally deduped per fingerprint (see recordSesHardenPatchWarning) so
  // production logs are not flooded by repeated identical warnings.
  return true;
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

// Stack frames that are bundler/runtime plumbing or SES/the monitor itself —
// never the actual library that performed the post-lockdown patch. Skipping
// them lets us surface the real offending dependency instead of, say,
// `__webpack_require__`.
const SES_HARDEN_STACK_FRAME_NOISE = [
  '__webpack_require__',
  'webpackJsonp',
  '__webpack_modules__',
  'sesHarden',
  'recordSesHardenPatchWarning',
  '/ses/',
  '/ses-',
];

// Split a stack string into its actual call-site frames, dropping the leading
// message line (e.g. "TypeError: Cannot assign to read only property
// 'constructor' ...") which carries no location. Previously the fingerprint
// accidentally used that message line as the "frame", so every override-mistake
// error from any library collapsed into one fingerprint.
function getPatchWarningStackFrames(value: unknown): string[] {
  const stack = getPatchErrorStack(value);
  if (!stack) {
    return [];
  }
  return stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '));
}

// Reduce a raw stack frame to its most diagnostic part: the `node_modules/<pkg>`
// path when present (so the offending dependency is immediately visible), else
// the frame text minus the leading `at `.
function normalizePatchWarningFrame(frame: string): string {
  const withoutPrefix = frame.replace(/^at\s+/u, '');
  const nodeModulesMatch = withoutPrefix.match(/node_modules[\\/]([^\s)]+)/u);
  return nodeModulesMatch ? nodeModulesMatch[1] : withoutPrefix;
}

function isNoisePatchWarningFrame(frame: string): boolean {
  return SES_HARDEN_STACK_FRAME_NOISE.some((needle) => frame.includes(needle));
}

// The library/call-site most likely responsible for the post-lockdown patch:
// the first real module frame (preferring `node_modules`) after skipping the
// message line and bundler/runtime plumbing. This is what the bare error
// message cannot tell you — e.g. it resolves to `decimal.js/decimal.js`.
function getPatchWarningCulprit(value: unknown): string | undefined {
  const frames = getPatchWarningStackFrames(value);
  if (!frames.length) {
    return undefined;
  }
  const moduleFrame = frames.find(
    (frame) =>
      frame.includes('node_modules') && !isNoisePatchWarningFrame(frame),
  );
  const chosen =
    moduleFrame ??
    frames.find((frame) => !isNoisePatchWarningFrame(frame)) ??
    frames[0];
  return normalizePatchWarningFrame(chosen);
}

function getPatchWarningFingerprint(
  kind: ISesHardenPatchWarningKind,
  value: unknown,
  culprit: string | undefined,
  event?: Event,
): string {
  return [
    kind,
    getPatchErrorMessage(value) ?? String(value),
    getStringProperty(event, 'filename') ?? culprit,
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
  const culprit = getPatchWarningCulprit(value);
  const fingerprint = getPatchWarningFingerprint(kind, value, culprit, event);
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
      culprit: culprit ?? existingWarning.culprit,
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
      culprit,
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

  // Emit (console.warn) only the first time we see a given fingerprint this
  // session. Repeated identical warnings still update the in-memory record's
  // count/lastSeenAt above, but must not re-emit: re-emitting would flood the
  // console and any downstream log sink with duplicate entries. We only emit
  // once we have recorded the fingerprint in the dedup set, so once the set
  // hits its cap any further brand-new fingerprints are dropped from emission
  // rather than emitted unbounded (a pathological flood of unique fingerprints
  // cannot spam the log).
  if (!sesHardenEmittedWarningFingerprints.has(fingerprint)) {
    if (
      sesHardenEmittedWarningFingerprints.size <
      SES_HARDEN_PATCH_WARNING_EMIT_FINGERPRINT_LIMIT
    ) {
      sesHardenEmittedWarningFingerprints.add(fingerprint);
      // Keep this visible so engineers can decide whether the patch belongs
      // before lockdown or indicates unexpected tampering. Enabled in
      // production too (see isSesHardenPatchWarningMonitorEnabled), deduped
      // per fingerprint.
      console.warn(
        `[OneKey SES Harden] Post-lockdown patch attempt detected${
          warning.culprit ? ` @ ${warning.culprit}` : ''
        }`,
        { warning },
      );
    }
  }
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

function defaultLoadSes(): void {
  // Loading SES installs globalThis.lockdown synchronously. Keep it out of the
  // module top level so L0 remains a true no-lockdown path.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('ses');
}

// Dependencies that perform the SES "override mistake" at module-init time:
// they assign `.constructor` (or another frozen-intrinsic property) onto an
// object whose prototype chain reaches Object.prototype, which throws (in
// strict mode) once `lockdown()` freezes Object.prototype — unless override for
// that property is enabled.
//
// The PRIMARY fix is `overrideTaming: 'severe'` (see options.ts): it enables
// override for all of Object.prototype, so these libraries work even when loaded
// after lockdown. This warm-up is kept as DEFENSE IN DEPTH: loading the
// offenders here, while intrinsics are still mutable, lets their init-time
// assignment land regardless of the override-taming setting (and the cached
// module is reused afterwards), so they stay safe even if that setting is ever
// relaxed to 'moderate'/'min'.
//
// Confirmed offenders (surfaced by the patch-warning monitor):
//  - decimal.js (pulled in by ripple-binary-codec for XRP) does
//    `Decimal.prototype.constructor = Decimal` on an object-literal prototype
//    inside clone().
//  - axios (lazily pulled in by @ton/ton's HttpApi, so it initializes AFTER
//    lockdown) runs a "reserved names hotfix" at module init: reduceDescriptors
//    assigns `constructor` onto a fresh `{}` whose prototype is the frozen
//    Object.prototype.
// bn.js / elliptic are NOT offenders (their inherits() chains keep a writable
// own constructor). Behavior is locked down by sesHardenLibCompat.test.ts. Add
// new offenders here as the patch-warning monitor surfaces their `culprit`.
function defaultWarmUpBeforeLockdown(): void {
  // Each warm-up is independent: a failure/absence of one must not skip the
  // others, so they get their own try/catch instead of sharing one.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    require('decimal.js');
  } catch {
    // Best-effort: a failed/missing warm-up must never block startup.
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    require('axios');
  } catch {
    // Best-effort: a failed/missing warm-up must never block startup.
  }
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
  warmUp?: () => void;
}): ISesHardenRuntimeState {
  const level = options.level ?? getSesHardenLevelFromRuntime(options.runtime);
  const lockdownOptions = getSesLockdownOptions(level, options.runtime);

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

  // Warm up known override-mistake libraries while intrinsics are still
  // mutable. Must run immediately before lockdown() freezes them.
  (options.warmUp ?? defaultWarmUpBeforeLockdown)();
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
  sesHardenEmittedWarningFingerprints.clear();
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
