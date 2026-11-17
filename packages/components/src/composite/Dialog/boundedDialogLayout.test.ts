import {
  getBoundedDialogScrollMaxHeight,
  getDialogKeyboardPaddingBottom,
} from './boundedDialogLayout';

describe('bounded dialog viewport math', () => {
  it.each<[string, number, number, boolean, number]>([
    ['iOS keyboard includes the home indicator', 336, 34, false, 336],
    ['Android keyboard excludes the system bar', 300, 48, true, 348],
  ])(
    '%s',
    (_name, keyboardHeight, safeAreaBottom, isNativeAndroid, expected) => {
      expect(
        getDialogKeyboardPaddingBottom({
          keyboardHeight,
          safeAreaBottom,
          isNativeAndroid,
        }),
      ).toBe(expected);
    },
  );

  it.each<[string, number, number, number, boolean, number]>([
    ['SE with keyboard', 667, 20, 300, false, 347],
    ['centered tablet with keyboard', 1024, 24, 400, true, 576],
    ['zero height floor', 100, 50, 80, false, 0],
  ])(
    '%s',
    (
      _name,
      windowHeight,
      topInset,
      keyboardPaddingBottom,
      isCentered,
      expected,
    ) => {
      expect(
        getBoundedDialogScrollMaxHeight({
          windowHeight,
          topInset,
          keyboardPaddingBottom,
          isCentered,
        }),
      ).toBe(expected);
    },
  );
});
