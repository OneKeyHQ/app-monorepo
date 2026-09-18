/**
 * The bottom edge of the window's usable area, measured from the window's
 * top: the system keyboard's top edge while it is up, the bottom safe-area
 * inset's otherwise. `keyboardHeight` is the keyboard feed's magnitude
 * (react-native-keyboard-controller): on Android it is the IME inset minus
 * the system bar, so the bar's inset still stacks under it; on iOS it
 * already spans the home-indicator zone. A worklet — the top-hung surfaces
 * (the hardware stage, the toasters) read it per keyboard frame.
 */
export function usableWindowBottom(
  windowHeight: number,
  bottomInset: number,
  keyboardHeight: number,
  isAndroid: boolean,
) {
  'worklet';

  if (keyboardHeight <= 0) {
    return windowHeight - bottomInset;
  }
  return windowHeight - keyboardHeight - (isAndroid ? bottomInset : 0);
}
