import FastImage from 'react-native-fast-image';

import type { IPreloadFunc } from './type';

export const ImageNet = FastImage;

export const preload: IPreloadFunc = ImageNet.preload;
