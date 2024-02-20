import type { IUseSource } from './type';
import type { ImageURISource } from 'react-native';

export const useSource: IUseSource = (source, src) => {
  if (!source && !src) {
    return;
  }
  if (src) {
    return {
      uri: src,
    };
  }

  if (
    typeof source === 'object' &&
    'uri' in (source as ImageURISource) &&
    !(source as ImageURISource).uri
  ) {
    return;
  }
  return source;
};
