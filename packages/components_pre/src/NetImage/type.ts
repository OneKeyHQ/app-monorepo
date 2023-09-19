import type { ComponentProps } from 'react';

import type { ThemeToken } from '../Provider/theme';
import type { Image as NBImage } from 'native-base';

export type ImageState = 'loading' | 'success' | 'fail' | null;

export type InnerImageProps = {
  onLoadStart?: () => void;
  onLoad?: () => void;
  onError?: () => void;
} & ImageProps;

export type ImageProps = {
  width: number | string;
  height: number | string;
  borderRadius?: number | string;
  bgColor?: ThemeToken;
  preview?: boolean;
  skeleton?: boolean;
  retry?: number;
  retryDuring?: number;
  fallbackElement?: JSX.Element;
  onErrorWithTask?: () => Promise<boolean>;
} & NBImageProps &
  FastImageProps;

type NBImageProps = Pick<
  ComponentProps<typeof NBImage>,
  'source' | 'alt' | 'src'
>;

type FastImageProps = {
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
  priority?: 'low' | 'normal' | 'high';
};
