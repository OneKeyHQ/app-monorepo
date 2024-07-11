import platformEnv from '../platformEnv';

const isMacOSStyleInBrowser = () => {
  if (typeof navigator !== 'undefined') {
    if ('platform' in navigator) {
      return navigator.platform.toLowerCase().indexOf('mac') > -1;
    }
    if ('userAgentData' in navigator) {
      return (
        ((
          navigator as { userAgentData?: { platform: string } }
        ).userAgentData?.platform
          .toLowerCase()
          .indexOf('mac') || -1) > -1
      );
    }
  }
  return false;
};

const isMacStyleKeyboard =
  platformEnv.isDesktopMac ||
  platformEnv.isNativeIOS ||
  isMacOSStyleInBrowser();

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
