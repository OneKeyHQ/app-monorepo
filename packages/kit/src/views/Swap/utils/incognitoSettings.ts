import type { ISettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';

type ISwapIncognitoSettings = Pick<
  ISettingsAtom,
  | 'swapEnableRecipientAddress'
  | 'swapIncognitoMode'
  | 'swapToAnotherAccountSwitchOn'
>;

export function buildSwapIncognitoSettingsUpdate<
  T extends ISwapIncognitoSettings,
>(settings: T, enabled: boolean): T {
  if (enabled) {
    return {
      ...settings,
      swapIncognitoMode: true,
      swapEnableRecipientAddress: true,
    };
  }

  return {
    ...settings,
    swapIncognitoMode: false,
    swapEnableRecipientAddress: true,
  };
}

export function buildSwapRecipientAddressSettingsUpdate<
  T extends ISwapIncognitoSettings,
>(settings: T, enabled: boolean): T {
  if (enabled) {
    return {
      ...settings,
      swapEnableRecipientAddress: true,
    };
  }

  return {
    ...settings,
    swapEnableRecipientAddress: false,
    swapToAnotherAccountSwitchOn: false,
    swapIncognitoMode: false,
  };
}
