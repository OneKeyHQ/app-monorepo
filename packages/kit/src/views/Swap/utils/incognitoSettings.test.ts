import {
  buildSwapIncognitoSettingsUpdate,
  buildSwapRecipientAddressSettingsUpdate,
} from './incognitoSettings';

describe('buildSwapIncognitoSettingsUpdate', () => {
  it('enables recipient tag', () => {
    expect(
      buildSwapIncognitoSettingsUpdate(
        {
          swapEnableRecipientAddress: false,
          swapIncognitoMode: false,
          swapToAnotherAccountSwitchOn: false,
        },
        true,
      ),
    ).toEqual({
      swapEnableRecipientAddress: true,
      swapIncognitoMode: true,
      swapToAnotherAccountSwitchOn: false,
    });
  });

  it('keeps recipient tag enabled when incognito mode is disabled', () => {
    expect(
      buildSwapIncognitoSettingsUpdate(
        {
          swapEnableRecipientAddress: true,
          swapIncognitoMode: true,
          swapToAnotherAccountSwitchOn: true,
        },
        false,
      ),
    ).toEqual({
      swapEnableRecipientAddress: true,
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
          swapIncognitoMode: true,
          swapToAnotherAccountSwitchOn: true,
        },
        false,
      ),
    ).toEqual({
      swapEnableRecipientAddress: false,
      swapIncognitoMode: false,
      swapToAnotherAccountSwitchOn: false,
    });
  });
});
