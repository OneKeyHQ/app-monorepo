import type { ICustomInjectionDevSettings } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

export async function showCustomInjectionSettingsDialog(_options?: {
  suggestedWorkspace?: string;
  onSaved?: (config: ICustomInjectionDevSettings) => Promise<void> | void;
}): Promise<boolean> {
  return false;
}
