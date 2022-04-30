import React, { PropsWithChildren } from 'react';

import ContentLoader, {
  IContentLoaderProps,
} from 'react-content-loader/native';

import { useThemeValue } from '../Provider/hooks';

import { Body1, Body2 } from './Shapes/index';

/* 
  Primary Component
*/
type SkeletonProps = {
  /* 
    number: width of svg viewBox and container
  */
  width?: number;
  /* 
    number: height of svg viewBox and container
  */
  height?: number;
  /* 
    Specific element
  */
  ele?: 'Body1' | 'Body2' | string | null;
} & IContentLoaderProps;

const renderElement = (ele?: SkeletonProps['ele'], width?: number) => {
  if (ele === 'Body1') return <Body1 width={width} />;
  if (ele === 'Body2') return <Body2 width={width} />;
  return null;
};

const renderELementHeight = (ele?: SkeletonProps['ele']) => {
  if (ele === 'Body1') return 24;
  if (ele === 'Body2') return 20;
  return undefined;
};

const Skeleton = ({
  children,
  width,
  height,
  ele,
  ...rest
}: PropsWithChildren<SkeletonProps>) => (
  <ContentLoader
    speed={1}
    width={width}
    height={ele ? renderELementHeight(ele) : height}
    viewBox={`0 0 ${String(width)} ${String(height)}`}
    backgroundColor={useThemeValue('surface-neutral-default')}
    foregroundColor={useThemeValue('surface-default')}
    {...rest}
  >
    {ele ? renderElement(ele, width) : children}
  </ContentLoader>
);

Skeleton.Body1 = Body1;
Skeleton.Body2 = Body2;

export default Skeleton;
export { Circle, Rect, Path } from 'react-content-loader/native';
