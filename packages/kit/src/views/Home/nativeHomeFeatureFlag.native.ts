import { isHomeContainerAvailable } from '@onekeyhq/native-components';

export function isNativeHomeEnabled(enabledByDeveloperMode = true): boolean {
  return enabledByDeveloperMode && isHomeContainerAvailable();
}
