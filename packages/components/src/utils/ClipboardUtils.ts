import * as Clipboard from 'expo-clipboard';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const copyToClipboard = (msg: string) => {
  Clipboard.setString(msg);
};

export const getClipboard = async () => {
  if (!platformEnv.canGetClipboard) {
    throw new Error('getClipboard is not allowed in Web and Extension');
  }
  const str = await Clipboard.getStringAsync();
  return str.trim();
};
