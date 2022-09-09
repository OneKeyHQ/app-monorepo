import React, { ComponentProps, FC } from 'react';

import Center from '../Center';
import Icon, { IconProps } from '../Icon';

export type IconShapeProps = {
  bgColor?: ComponentProps<typeof Center>['bgColor'];
  bgPadding?: ComponentProps<typeof Center>['p'];
  rounded?: ComponentProps<typeof Center>['rounded'];
} & IconProps;

const defaultProps = {
  color: 'icon-default',
  bgColor: 'surface-neutral-default',
  padding: 3,
  size: 24,
  rounded: 'full',
} as const;

const IconShape: FC<IconShapeProps> = ({ bgPadding, bgColor, ...props }) => (
  <Center p={bgPadding} rounded="full" bgColor={bgColor}>
    <Icon {...props} />
  </Center>
);

IconShape.defaultProps = defaultProps;
export default IconShape;
