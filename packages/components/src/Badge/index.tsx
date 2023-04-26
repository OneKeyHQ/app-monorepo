import type { ComponentProps, FC } from 'react';

import { Badge as NBBadge } from 'native-base';

import type { Text } from '@onekeyhq/components';

import Typography from '../Typography';

export type BadgeType = 'default' | 'success' | 'info' | 'warning' | 'critical';
type SizeType = 'sm' | 'lg';

export type BadgeProps = {
  type?: BadgeType;
  title: string;
  size: SizeType;
  color?: ComponentProps<typeof Typography.CaptionStrong>['color'];
  labelProps?: ComponentProps<typeof Text>;
  numberOfLines?: number;
} & ComponentProps<typeof NBBadge>;

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

function bgColorWithType(badgeType: BadgeType) {
  switch (badgeType) {
    case 'default':
      return 'surface-neutral-subdued';
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

function textColorWithType(badgeType: BadgeType) {
  switch (badgeType) {
    case 'default':
      return 'text-default';
    case 'success':
      return 'text-success';
    case 'info':
      return 'text-highlight';
    case 'warning':
      return 'text-warning';
    default:
      return 'text-critical';
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

const Badge: FC<BadgeProps> = ({
  title,
  type = 'default',
  size,
  color,
  labelProps,
  ...rest
}) => {
  const bgColor: string = bgColorWithType(type);
  const textColor: string = textColorWithType(type);
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
      {...rest}
    >
      <Typography.CaptionStrong
        marginX={badgeTypeProps.marginX}
        marginY="2px"
        fontSize={badgeTypeProps.fontSize}
        lineHeight={badgeTypeProps.lineHeight}
        color={color || textColor}
        {...labelProps}
      >
        {title}
      </Typography.CaptionStrong>
    </NBBadge>
  );
};
export default Badge;
