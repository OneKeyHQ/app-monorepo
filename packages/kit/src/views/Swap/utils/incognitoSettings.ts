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
    };
  }

  return {
    ...settings,
    swapIncognitoMode: false,
    ...(settings.swapEnableRecipientAddress
      ? {}
      : {
          swapToAnotherAccountSwitchOn: false,
        }),
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
    ...(settings.swapIncognitoMode
      ? {}
      : {
          swapToAnotherAccountSwitchOn: false,
        }),
  };
}
