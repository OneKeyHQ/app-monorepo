import {
  buildSwapIncognitoSettingsUpdate,
  buildSwapRecipientAddressSettingsUpdate,
} from './incognitoSettings';

describe('buildSwapIncognitoSettingsUpdate', () => {
  it('enables recipient tag and snapshots the previous recipient state', () => {
    expect(
      buildSwapIncognitoSettingsUpdate(
        {
          swapEnableRecipientAddress: false,
          swapEnableRecipientAddressBeforeIncognito: undefined,
          swapIncognitoMode: false,
          swapToAnotherAccountSwitchOn: false,
        },
        true,
      ),
    ).toEqual({
      swapEnableRecipientAddress: true,
      swapEnableRecipientAddressBeforeIncognito: false,
      swapIncognitoMode: true,
      swapToAnotherAccountSwitchOn: false,
    });
  });

  it('restores the previous recipient state when incognito mode is disabled', () => {
    expect(
      buildSwapIncognitoSettingsUpdate(
        {
          swapEnableRecipientAddress: true,
          swapEnableRecipientAddressBeforeIncognito: false,
          swapIncognitoMode: true,
          swapToAnotherAccountSwitchOn: true,
        },
        false,
      ),
    ).toEqual({
      swapEnableRecipientAddress: false,
      swapEnableRecipientAddressBeforeIncognito: undefined,
      swapIncognitoMode: false,
      swapToAnotherAccountSwitchOn: false,
    });
  });

  it('keeps the current recipient selection when the previous state was enabled', () => {
    expect(
      buildSwapIncognitoSettingsUpdate(
        {
          swapEnableRecipientAddress: true,
          swapEnableRecipientAddressBeforeIncognito: true,
          swapIncognitoMode: true,
          swapToAnotherAccountSwitchOn: true,
        },
        false,
      ),
    ).toEqual({
      swapEnableRecipientAddress: true,
      swapEnableRecipientAddressBeforeIncognito: undefined,
      swapIncognitoMode: false,
      swapToAnotherAccountSwitchOn: true,
    });
  });
});

describe('buildSwapRecipientAddressSettingsUpdate', () => {
  it('turns off incognito mode when recipient tag is manually disabled', () => {
    expect(
      buildSwapRecipientAddressSettingsUpdate(
        {
          swapEnableRecipientAddress: true,
          swapEnableRecipientAddressBeforeIncognito: false,
          swapIncognitoMode: true,
          swapToAnotherAccountSwitchOn: true,
        },
        false,
      ),
    ).toEqual({
      swapEnableRecipientAddress: false,
      swapEnableRecipientAddressBeforeIncognito: undefined,
      swapIncognitoMode: false,
      swapToAnotherAccountSwitchOn: false,
    });
  });
});
