import React, { FC } from 'react';

import { Badge as NBBadge } from 'native-base';

import Typography from '../Typography';

type BadgeType = 'Default' | 'Success' | 'Info' | 'Warning' | 'Critical';
type SizeType = 'sm' | 'lg';

export type BadgeProps = {
  title: string;
  type: BadgeType;
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
    case 'Default':
      return 'surface-neutral-default';
    case 'Success':
      return 'surface-success-default';
    case 'Info':
      return 'surface-highlight-default';
    case 'Warning':
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

export const Badge: FC<BadgeProps> = ({ title, type, size }) => {
  const bgColor: string = colorWithType(type);
  const badgeTypeProps = propsWithSize(size);

  return (
    <NBBadge
      padding="0px"
      variant="solid"
      alignSelf="center"
      borderRadius="6px"
      bgColor={bgColor}
    >
      <Typography.Caption
        marginX={badgeTypeProps.marginX}
        marginY="2px"
        fontSize={badgeTypeProps.fontSize}
        lineHeight={badgeTypeProps.lineHeight}
      >
        {title}
      </Typography.Caption>
    </NBBadge>
  );
};
export default Badge;
