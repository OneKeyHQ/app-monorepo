import * as Clipboard from 'expo-clipboard';

export const copyToClipboard = (msg: string) => {
  Clipboard.setString(msg);
};

export const getClipboard = () => Clipboard.getStringAsync();
