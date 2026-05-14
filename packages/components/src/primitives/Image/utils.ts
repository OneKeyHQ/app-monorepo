import type { ImageSource } from 'expo-image';
import type { ImageURISource } from 'react-native';

export const isEmptyResolvedSource = (source?: ImageSource | null) => {
  if (!source) return true;
  if (typeof source !== 'object') return false;
  const uri = (source as ImageURISource).uri;
  return uri === '' || uri === null || uri === undefined;
};
