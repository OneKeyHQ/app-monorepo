import type { ImageSourcePropType, ImageURISource } from 'react-native';

export const getSourceKey = (source?: ImageSourcePropType) =>
  typeof source === 'object' ? (source as ImageURISource).uri : source;
