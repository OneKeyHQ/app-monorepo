/**
 * Viewport math for the native opt-in bounded Dialog sheet (OK-63232).
 *
 * DialogFrame lifts the sheet with paddingBottom =
 * max(keyboardHeight + AndroidBottomInset, safeBottom). That padding is a
 * real layout region, so the scroll cap must subtract the same value exactly
 * once. iOS keyboard events already include the home-indicator inset; Android
 * events exclude the system-bar inset, which is restored only on Android.
 * Negative keyboard heights are normalized to 330 in DialogFrame before this
 * padding is applied.
 */

export type IDialogKeyboardPaddingBottomParams = {
  keyboardHeight: number;
  safeAreaBottom: number;
  isNativeAndroid: boolean;
};

export type IBoundedDialogScrollMaxHeightParams = {
  windowHeight: number;
  topInset: number;
  keyboardPaddingBottom: number;
  isCentered?: boolean;
};

export function getDialogKeyboardPaddingBottom({
  keyboardHeight,
  safeAreaBottom,
  isNativeAndroid,
}: IDialogKeyboardPaddingBottomParams): number {
  'worklet';

  const androidBottomInset = isNativeAndroid ? safeAreaBottom : 0;
  return Math.max(keyboardHeight + androidBottomInset, safeAreaBottom);
}

export function getBoundedDialogScrollMaxHeight({
  windowHeight,
  topInset,
  keyboardPaddingBottom,
  isCentered = false,
}: IBoundedDialogScrollMaxHeightParams): number {
  // Centered tablet dialogs need equal clearance above and below their frame.
  const verticalClearance = topInset * (isCentered ? 2 : 1);
  return Math.max(0, windowHeight - verticalClearance - keyboardPaddingBottom);
}
