// cspell:ignore lockdown Lockdown
import type { Harden, LockdownOptions } from 'ses';

export type ISesHardenLevel = 'L0' | 'L1' | 'L2';

export type ISesHardenRuntime =
  | 'web'
  | 'desktop-renderer'
  | 'ext-ui'
  | 'ext-background'
  | 'ext-offscreen'
  | 'ext-passkey';

export type ISesHardenRuntimeState = {
  level: ISesHardenLevel;
  runtime: ISesHardenRuntime;
  lockdownApplied: boolean;
  evalTaming?: LockdownOptions['evalTaming'];
  objectPrototypeFrozen: boolean;
  reason?: string;
};

export type ISesHardenPatchWarningKind = 'error' | 'unhandledrejection';

export type ISesHardenPatchWarning = {
  id: number;
  createdAt: string;
  lastSeenAt: string;
  level: ISesHardenLevel;
  runtime: ISesHardenRuntime;
  kind: ISesHardenPatchWarningKind;
  fingerprint: string;
  count: number;
  message: string;
  stack?: string;
  // The library/call-site most likely responsible for the post-lockdown patch,
  // extracted from `stack` (preferring the first `node_modules/<pkg>` frame,
  // e.g. `decimal.js/decimal.js`). The bare `message` is identical for every
  // override-mistake error, so this is what actually tells you WHICH dependency
  // patched a frozen intrinsic.
  culprit?: string;
  source?: string;
  lineno?: number;
  colno?: number;
};

export type ISesHardenGlobal = {
  __ONEKEY_SES_HARDEN_STATE__?: ISesHardenRuntimeState;
  __ONEKEY_SES_HARDEN_PATCH_WARNINGS__?: ISesHardenPatchWarning[];
  __ONEKEY_SES_HARDEN_PATCH_WARNING_COUNT__?: number;
  __ONEKEY_SES_HARDEN_PATCH_WARNING_MONITOR_INSTALLED__?: boolean;
  harden?: Harden;
  lockdown?: (options?: LockdownOptions) => void;
  addEventListener?: typeof globalThis.addEventListener;
};
