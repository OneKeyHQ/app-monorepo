import type { IUseSource } from './type';
import type { ImageSourcePropType, ImageURISource } from 'react-native';

export const useSource: IUseSource = (source, src) => {
  if (!source && !src) {
    return;
  }
  if (src) {
    return {
      uri: src,
    };
  }
  const uriSource = source as ImageURISource;
  // ImageRequireSource will be convert to the link via Webpack
  return (uriSource.uri ? uriSource : { uri: source }) as ImageSourcePropType;
};
