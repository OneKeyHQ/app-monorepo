import { type FC } from 'react';

import { Stack, styled } from '@tamagui/core';
import { Text } from '../Text'
const BadgeFrame = styled(Stack, {
  name: 'BadgeFrame',
  paddingHorizontal: '$2',
  paddingVertical: '$0.5',
  backgroundColor: '$bgStrong',
  borderRadius: '$1',
})

type BadgeType = 'success' | 'info' | 'warning' | 'critical' | 'default'


const bgColors: Record<BadgeType, string> = {
  'success': '$bgSuccess',
  'info': '$bgInfo',
  'warning': '$bgCaution',
  'critical': '$bgCritical',
  'default': '$bgStrong'
}

const textColors: Record<BadgeType, string> = {
  'success': '$textSuccess',
  'info': '$textInfo',
  'warning': '$textCaution',
  'critical': '$textCritical',
  'default': '$textSubdued'
}

type BadgeProps = {
  type: BadgeType;
  size: 'lg' | 'sm'
};

export const Badge: FC<BadgeProps> = ({ children, type, size }) => {
  const bgColor = bgColors[type]
  const textColor = textColors[type]
  const variant = size === 'sm' ? '$bodySmMedium': '$bodyMdMedium'
  return (
    <BadgeFrame backgroundColor={bgColor}>
      <Text color={textColor} variant={variant}>{children}</Text>
    </BadgeFrame>
  )
};
