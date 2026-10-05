import {
  blurFocusedInput,
  dismissKeyboard,
} from '@onekeyhq/shared/src/keyboard';

import { dismissMobileTokenSelectorKeyboard } from './dismissMobileTokenSelectorKeyboard';

const blurFocusedInputMock = jest.mocked(blurFocusedInput);
const dismissKeyboardMock = jest.mocked(dismissKeyboard);

jest.mock('@onekeyhq/shared/src/keyboard', () => ({
  blurFocusedInput: jest.fn(),
  dismissKeyboard: jest.fn(),
}));

describe('dismissMobileTokenSelectorKeyboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blurs the focused RN input and does not force-hide the IME', () => {
    dismissMobileTokenSelectorKeyboard();

    expect(blurFocusedInputMock).toHaveBeenCalledTimes(1);
    expect(dismissKeyboardMock).not.toHaveBeenCalled();
  });
});
