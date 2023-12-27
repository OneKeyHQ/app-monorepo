import type { IUseSource } from './type';
import type { ImageSourcePropType, ImageURISource } from 'react-native';

export const useSource: IUseSource = (source) => {
  if (!source) {
    return;
  }
  const uriSource = source as ImageURISource;
  // ImageRequireSource will be convert to the link via Webpack
  return (uriSource.uri ? uriSource : { uri: source }) as ImageSourcePropType;
};
