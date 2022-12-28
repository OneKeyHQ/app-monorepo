import type { PropsWithChildren } from 'react';

import ContentLoader from 'react-content-loader/native';

import { useThemeValue } from '@onekeyhq/components';

import {
  Avatar,
  Body1,
  Body2,
  Caption,
  DisplayXLarge,
  Heading,
  PageHeading,
} from './Shapes';

import type { IContentLoaderProps } from 'react-content-loader/native';

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
  shape?:
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
    | 'DisplayXLarge'
    | 'Display2XLarge';
} & IContentLoaderProps;

const defaultProps = {
  size: 32,
};

const renderShape = (
  shape?: SkeletonProps['shape'],
  width?: SkeletonProps['width'],
  size?: SkeletonProps['size'],
) => {
  if (shape === 'DisplayXLarge') return <DisplayXLarge width={width} />;
  if (shape === 'PageHeading' || shape === 'DisplayLarge')
    return <PageHeading width={width} />;
  if (shape === 'Heading' || shape === 'DisplayMedium')
    return <Heading width={width} />;
  if (shape === 'Body1' || shape === 'DisplaySmall')
    return <Body1 width={width} />;
  if (shape === 'Body2') return <Body2 width={width} />;
  if (shape === 'Caption' || shape === 'Subheading')
    return <Caption width={width} />;
  if (shape === 'Avatar')
    return (
      <Avatar
        r={size && Number(size) / 2}
        cx={size && Number(size) / 2}
        cy={size && Number(size) / 2}
      />
    );
  return null;
};

const renderShapeWidth = (
  shape?: SkeletonProps['shape'],
  size?: SkeletonProps['size'],
) => {
  if (shape === 'DisplayXLarge') return 128;
  if (shape === 'PageHeading' || shape === 'DisplayLarge') return 112;
  if (shape === 'Heading' || shape === 'DisplayMedium') return 96;
  if (shape === 'Body1' || shape === 'DisplaySmall') return 80;
  if (shape === 'Body2') return 64;
  if (shape === 'Caption' || shape === 'Subheading') return 48;
  if (shape === 'Avatar') return !size ? 32 : size;
  return undefined;
};

const renderShapeHeight = (
  shape?: SkeletonProps['shape'],
  size?: SkeletonProps['size'],
) => {
  if (shape === 'DisplayXLarge') return 36;
  if (shape === 'PageHeading' || shape === 'DisplayLarge') return 32;
  if (shape === 'Heading' || shape === 'DisplayMedium') return 28;
  if (shape === 'Body1' || shape === 'DisplaySmall') return 24;
  if (shape === 'Body2') return 20;
  if (shape === 'Caption' || shape === 'Subheading') return 16;
  if (shape === 'Avatar') return !size ? 32 : size;
  return undefined;
};

const Skeleton = ({
  children,
  width,
  height,
  size,
  shape,
  ...rest
}: PropsWithChildren<SkeletonProps>) => {
  const w = shape ? renderShapeWidth(shape, size) : width;
  const h = shape ? renderShapeHeight(shape, size) : height;
  return (
    <ContentLoader
      speed={1}
      width={w}
      height={h}
      viewBox={`0 0 ${String(w)} ${String(h)}`}
      backgroundColor={useThemeValue('surface-neutral-default')}
      foregroundColor={useThemeValue('surface-default')}
      {...rest}
    >
      {shape ? renderShape(shape, width, size) : children}
    </ContentLoader>
  );
};

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
