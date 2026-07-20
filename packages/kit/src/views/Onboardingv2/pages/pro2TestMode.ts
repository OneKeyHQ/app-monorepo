import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  type IDevSettingsPersistAtom,
  isPro2DebugModuleEnabled,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

import type { HardwareConnectProtocol } from '@onekeyfe/hd-shared';

export function shouldShowPro2OnboardingEntry(
  devSettings: IDevSettingsPersistAtom,
): boolean {
  return isPro2DebugModuleEnabled(devSettings, 'onboarding');
}

export function getOnboardingConnectProtocol({
  deviceTypeItems,
  devSettings,
}: {
  deviceTypeItems: EDeviceType[];
  devSettings: IDevSettingsPersistAtom;
}): HardwareConnectProtocol | undefined {
  if (
    isPro2DebugModuleEnabled(devSettings, 'onboarding') &&
    deviceTypeItems.length === 1 &&
    deviceTypeItems[0] === EDeviceType.Pro2
  ) {
    return 'V2';
  }
  return undefined;
}
