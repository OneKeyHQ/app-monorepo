import type { IAppInstallationClassification } from './launchStateStorage.shared';

export function classifyNativeAppInstallation({
  installationTime,
  lastUpdateTime,
  platform,
}: {
  installationTime: number;
  lastUpdateTime?: number;
  platform: 'android' | 'ios';
}): IAppInstallationClassification {
  if (
    platform === 'android' &&
    lastUpdateTime !== undefined &&
    Math.abs(lastUpdateTime - installationTime) <= 1000
  ) {
    return 'freshInstall';
  }
  return 'unknown';
}
