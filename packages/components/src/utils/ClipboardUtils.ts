import { getStringAsync, setStringAsync } from 'expo-clipboard';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const copyToClipboard = setStringAsync;

export const getClipboard = async () => {
  if (!platformEnv.canGetClipboard) {
    throw new Error('getClipboard is not allowed in Web and Extension');
  }
  const str = await getStringAsync();
  return str.trim();
};
