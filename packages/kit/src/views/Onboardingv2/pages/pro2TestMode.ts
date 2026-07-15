import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  type IDevSettingsPersistAtom,
  isPro2TestModeEnabled,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

import type { HardwareConnectProtocol } from '@onekeyfe/hd-shared';

export function shouldShowPro2OnboardingEntry(
  devSettings: IDevSettingsPersistAtom,
): boolean {
  return isPro2TestModeEnabled(devSettings);
}

export function getOnboardingConnectProtocol({
  deviceTypeItems,
  devSettings,
}: {
  deviceTypeItems: EDeviceType[];
  devSettings: IDevSettingsPersistAtom;
}): HardwareConnectProtocol | undefined {
  if (
    isPro2TestModeEnabled(devSettings) &&
    deviceTypeItems.length === 1 &&
    deviceTypeItems[0] === EDeviceType.Pro2
  ) {
    return 'V2';
  }
  return undefined;
}
