import { blurFocusedInput } from '@onekeyhq/shared/src/keyboard';

// SearchBar is an RN TextInput. Blur it instead of KeyboardController.dismiss()
// so Android does not hideSoftInputFromWindow and then skip the next autoFocus.
export function dismissMobileTokenSelectorKeyboard() {
  blurFocusedInput();
}
