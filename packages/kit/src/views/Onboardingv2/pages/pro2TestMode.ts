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
  devSettings: _devSettings,
}: {
  deviceTypeItems: EDeviceType[];
  devSettings: IDevSettingsPersistAtom;
}): HardwareConnectProtocol | undefined {
  if (deviceTypeItems.length === 1 && deviceTypeItems[0] === EDeviceType.Pro2) {
    return 'V2';
  }
  if (
    deviceTypeItems.length > 0 &&
    !deviceTypeItems.includes(EDeviceType.Pro2)
  ) {
    return 'V1';
  }
  return undefined;
}
