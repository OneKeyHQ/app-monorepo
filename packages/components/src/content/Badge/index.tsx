import type { FC, PropsWithChildren } from 'react';

import { styled } from '@tamagui/core';

import { Stack, Text } from '../../primitives';

const BadgeFrame = styled(Stack, {
  name: 'BadgeFrame',
  paddingHorizontal: '$2',
  paddingVertical: '$0.5',
  backgroundColor: '$bgStrong',
  borderRadius: '$1',
});

type IBadgeType = 'success' | 'info' | 'warning' | 'critical' | 'default';

const bgColors: Record<IBadgeType, string> = {
  'success': '$bgSuccess',
  'info': '$bgInfo',
  'warning': '$bgCaution',
  'critical': '$bgCritical',
  'default': '$bgStrong',
};

const textColors: Record<IBadgeType, string> = {
  'success': '$textSuccess',
  'info': '$textInfo',
  'warning': '$textCaution',
  'critical': '$textCritical',
  'default': '$textSubdued',
};

type IBadgeProps = PropsWithChildren<{
  type: IBadgeType;
  size: 'lg' | 'sm';
}>;

export const Badge: FC<IBadgeProps> = ({ children, type, size }) => {
  const bgColor = bgColors[type];
  const textColor = textColors[type];
  const variant = size === 'sm' ? '$bodySmMedium' : '$bodyMdMedium';
  return (
    <BadgeFrame backgroundColor={bgColor}>
      <Text color={textColor} variant={variant}>
        {children}
      </Text>
    </BadgeFrame>
  );
};
