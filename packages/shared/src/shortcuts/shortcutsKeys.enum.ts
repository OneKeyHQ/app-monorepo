import platformEnv from '../platformEnv';

const isMacStyleKeyboard =
  platformEnv.isDesktopMac ||
  platformEnv.isNativeIOS ||
  platformEnv.isRuntimeMacOSBrowser;

export const shortcutsKeys = {
  CmdOrCtrl: isMacStyleKeyboard ? '⌘' : 'Ctrl',
  Alt: isMacStyleKeyboard ? '⌥' : 'Alt',
  Shift: isMacStyleKeyboard ? '⇧' : 'Shift',
  Left: '←',
  Right: '→',
  Up: '↑',
  Down: '↓',
  Search: '/',
};
