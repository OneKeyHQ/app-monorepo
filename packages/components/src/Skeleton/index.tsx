import React, { PropsWithChildren } from 'react';

import ContentLoader, {
  IContentLoaderProps,
} from 'react-content-loader/native';

import { useThemeValue } from '../Provider/hooks';

import {
  Avatar,
  Body1,
  Body2,
  Caption,
  Heading,
  PageHeading,
  DisplayXLarge,
} from './Shapes';

type SkeletonProps = {
  /* 
    width of svg viewBox and container
  */
  width?: number | string;
  /* 
    height of svg viewBox and container
  */
  height?: number | string;
  /* 
    size of circle
  */
  size?: number | string;
  /* 
    Specific element
  */
  ele?:
    | 'Body1'
    | 'Body2'
    | 'Avatar'
    | 'Caption'
    | 'Subheading'
    | 'Heading'
    | 'DisplaySmall'
    | 'DisplayMedium'
    | 'PageHeading'
    | 'DisplayLarge'
    | 'DisplayXLarge';
} & IContentLoaderProps;

const defaultProps = {
  size: 32,
};

const renderElement = (
  ele?: SkeletonProps['ele'],
  width?: SkeletonProps['width'],
  size?: SkeletonProps['size'],
) => {
  if (ele === 'DisplayXLarge') return <DisplayXLarge width={width} />;
  if (ele === 'PageHeading' || ele === 'DisplayLarge')
    return <PageHeading width={width} />;
  if (ele === 'Heading' || ele === 'DisplayMedium')
    return <Heading width={width} />;
  if (ele === 'Body1' || ele === 'DisplaySmall') return <Body1 width={width} />;
  if (ele === 'Body2') return <Body2 width={width} />;
  if (ele === 'Caption' || ele === 'Subheading')
    return <Caption width={width} />;
  if (ele === 'Avatar')
    return (
      <Avatar
        r={size && Number(size) / 2}
        cx={size && Number(size) / 2}
        cy={size && Number(size) / 2}
      />
    );
  return null;
};

const renderELementHeight = (
  ele?: SkeletonProps['ele'],
  size?: SkeletonProps['size'],
) => {
  if (ele === 'DisplayXLarge') return 36;
  if (ele === 'PageHeading' || ele === 'DisplayLarge') return 32;
  if (ele === 'Heading' || ele === 'DisplayMedium') return 28;
  if (ele === 'Body1' || ele === 'DisplaySmall') return 24;
  if (ele === 'Body2') return 20;
  if (ele === 'Caption' || ele === 'Subheading') return 16;
  if (ele === 'Avatar') return !size ? 32 : size;
  return undefined;
};

const Skeleton = ({
  children,
  width,
  height,
  size,
  ele,
  ...rest
}: PropsWithChildren<SkeletonProps>) => (
  <ContentLoader
    speed={1}
    width={ele === 'Avatar' ? size : width}
    height={ele ? renderELementHeight(ele, size) : height}
    viewBox={`0 0 ${String(width)} ${String(height)}`}
    backgroundColor={useThemeValue('surface-neutral-default')}
    foregroundColor={useThemeValue('surface-default')}
    {...rest}
  >
    {ele ? renderElement(ele, width, size) : children}
  </ContentLoader>
);

Skeleton.Avatar = Avatar;
Skeleton.DisplayXLarge = DisplayXLarge;
Skeleton.PageHeading = PageHeading;
Skeleton.DisplayLarge = PageHeading;
Skeleton.Body1 = Body1;
Skeleton.DisplaySmall = Body1;
Skeleton.Body2 = Body2;
Skeleton.Caption = Caption;
Skeleton.Subheading = Caption;
Skeleton.defaultPorps = defaultProps;

export default Skeleton;
export { Circle, Rect, Path } from 'react-content-loader/native';
