import {
  EUpdateFileType,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import type { ISoftwareUpdateParams } from '@onekeyhq/shared/src/logger/scopes/app/scenes/appUpdate';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

export function getUpdatePlatform() {
  if (platformEnv.isNativeIOS) return 'ios';
  if (platformEnv.isNativeAndroid) return 'android';
  if (platformEnv.isDesktop) return 'desktop';
  if (platformEnv.isExtension) return 'extension';
  return 'web';
}

const updateStrategyMap: Record<EUpdateStrategy, string> = {
  [EUpdateStrategy.silent]: 'silent',
  [EUpdateStrategy.force]: 'force',
  [EUpdateStrategy.manual]: 'manual',
  [EUpdateStrategy.seamless]: 'seamless',
};

export function asOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return String(value);
}

export function asString(value: unknown): string {
  return asOptionalString(value) ?? '';
}

export function buildSoftwareUpdateParams(
  fileType: EUpdateFileType,
  appUpdateInfo: IAppUpdateInfo,
  attemptId?: string,
): ISoftwareUpdateParams {
  const isBundle = fileType === EUpdateFileType.jsBundle;
  return {
    attemptId: attemptId ?? generateUUID(),
    updateType: isBundle ? 'bundle' : 'app',
    fromVersion: isBundle
      ? asString(platformEnv.bundleVersion)
      : asString(platformEnv.version),
    toVersion: isBundle
      ? asString(appUpdateInfo.jsBundleVersion)
      : asString(appUpdateInfo.latestVersion),
    updateStrategy:
      updateStrategyMap[appUpdateInfo.updateStrategy] ?? 'unknown',
    platform: getUpdatePlatform(),
  };
}

// Shared across the entire update flow so all step events carry the same
// attemptId. `rotateUpdateAttemptId()` is called by downloadPackage() when
// a fresh attempt starts; resume-mid-flow callers (verifyASC / verifyPackage
// / installPackage on cold launch) lazy-init via ensureUpdateAttemptId so a
// single resumed flow keeps one stable id end-to-end instead of fabricating
// a new UUID per step (which would break Mixpanel funnel correlation when
// the user backgrounded mid-verify and came back).
let currentUpdateAttemptId: string | undefined;

export function getUpdateAttemptId(): string | undefined {
  return currentUpdateAttemptId;
}

export function ensureUpdateAttemptId(): string {
  if (!currentUpdateAttemptId) {
    currentUpdateAttemptId = generateUUID();
  }
  return currentUpdateAttemptId;
}

export function rotateUpdateAttemptId(): string {
  currentUpdateAttemptId = generateUUID();
  return currentUpdateAttemptId;
}

// Test-only: resets the module state between cases. Intentionally not
// exposed via index.ts so production code can't accidentally depend on it.
export function __resetUpdateAttemptIdForTests() {
  currentUpdateAttemptId = undefined;
}
