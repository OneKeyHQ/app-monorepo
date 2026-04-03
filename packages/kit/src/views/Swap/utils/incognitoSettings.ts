import type { ISettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';

type ISwapIncognitoSettings = Pick<
  ISettingsAtom,
  | 'swapEnableRecipientAddress'
  | 'swapEnableRecipientAddressBeforeIncognito'
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
      swapEnableRecipientAddressBeforeIncognito: settings.swapIncognitoMode
        ? settings.swapEnableRecipientAddressBeforeIncognito
        : settings.swapEnableRecipientAddress,
    };
  }

  const shouldEnableRecipientAddress =
    settings.swapEnableRecipientAddressBeforeIncognito ??
    settings.swapEnableRecipientAddress;

  return {
    ...settings,
    swapIncognitoMode: false,
    swapEnableRecipientAddress: shouldEnableRecipientAddress,
    swapEnableRecipientAddressBeforeIncognito: undefined,
    swapToAnotherAccountSwitchOn: shouldEnableRecipientAddress
      ? settings.swapToAnotherAccountSwitchOn
      : false,
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
    swapEnableRecipientAddressBeforeIncognito: undefined,
  };
}
