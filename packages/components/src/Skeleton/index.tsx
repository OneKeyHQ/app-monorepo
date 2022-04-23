import React, { FC } from 'react';

import ContentLoader, {
  IContentLoaderProps,
} from 'react-content-loader/native';

import { useThemeValue } from '../Provider/hooks';

type SkeletonProps = {
  /* 
    number: width of svg viewBox and container
  */
  width?: number;
  /* 
    number: height of svg viewBox and container
  */
  height?: number;
} & IContentLoaderProps;

const Skeleton: FC<SkeletonProps> = ({ children, width, height, ...rest }) => (
  <ContentLoader
    speed={1}
    width={width}
    height={height}
    viewBox={`0 0 ${String(width)} ${String(height)}`}
    backgroundColor={useThemeValue('surface-neutral-default')}
    foregroundColor={useThemeValue('surface-default')}
    {...rest}
  >
    {children}
  </ContentLoader>
);

export default Skeleton;
export { Circle, Rect, Path } from 'react-content-loader/native';
