import React, { FC } from 'react';

import { Badge as NBBadge } from 'native-base';

import Typography from '../Typography';

export type BadgeType = 'default' | 'success' | 'info' | 'warning' | 'critical';
type SizeType = 'sm' | 'lg';

export type BadgeProps = {
  type?: BadgeType;
  title: string;
  size: SizeType;
};

type BadgeTypeProps = {
  fontSize: string;
  lineHeight: string;
  marginX: string;
};

const lgProps: BadgeTypeProps = {
  fontSize: '14px',
  lineHeight: '20px',
  marginX: '8px',
};

const smProps: BadgeTypeProps = {
  fontSize: '12px',
  lineHeight: '16px',
  marginX: '6px',
};

function colorWithType(badgeType: BadgeType) {
  switch (badgeType) {
    case 'default':
      return 'surface-neutral-default';
    case 'success':
      return 'surface-success-default';
    case 'info':
      return 'surface-highlight-default';
    case 'warning':
      return 'surface-warning-default';
    default:
      return 'surface-critical-default';
  }
}

function propsWithSize(sizeType: SizeType) {
  switch (sizeType) {
    case 'lg':
      return lgProps;
    default:
      return smProps;
  }
}

const Badge: FC<BadgeProps> = ({ title, type = 'default', size }) => {
  const bgColor: string = colorWithType(type);
  const badgeTypeProps = propsWithSize(size);

  return (
    <NBBadge
      padding="0px"
      variant="solid"
      alignSelf="center"
      borderRadius="6px"
      bgColor={bgColor}
      minW={5}
      borderWidth={0}
    >
      <Typography.CaptionStrong
        marginX={badgeTypeProps.marginX}
        marginY="2px"
        fontSize={badgeTypeProps.fontSize}
        lineHeight={badgeTypeProps.lineHeight}
      >
        {title}
      </Typography.CaptionStrong>
    </NBBadge>
  );
};
export default Badge;
