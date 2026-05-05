import {
  buildSwapIncognitoSettingsUpdate,
  buildSwapRecipientAddressSettingsUpdate,
} from './incognitoSettings';

describe('buildSwapIncognitoSettingsUpdate', () => {
  it('keeps recipient setting untouched when incognito mode is enabled', () => {
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
      swapEnableRecipientAddress: false,
      swapIncognitoMode: true,
      swapToAnotherAccountSwitchOn: false,
    });
  });

  it('keeps recipient setting untouched when incognito mode is disabled', () => {
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

  it('clears custom recipient when incognito mode is disabled and recipient setting is off', () => {
    expect(
      buildSwapIncognitoSettingsUpdate(
        {
          swapEnableRecipientAddress: false,
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

describe('buildSwapRecipientAddressSettingsUpdate', () => {
  it('keeps incognito mode on when recipient setting is manually disabled', () => {
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
      swapIncognitoMode: true,
      swapToAnotherAccountSwitchOn: true,
    });
  });

  it('clears custom recipient when recipient setting is disabled outside incognito mode', () => {
    expect(
      buildSwapRecipientAddressSettingsUpdate(
        {
          swapEnableRecipientAddress: true,
          swapIncognitoMode: false,
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
