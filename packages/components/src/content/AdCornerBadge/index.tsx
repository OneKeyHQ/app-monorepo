import { memo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SizableText, Stack } from '../../primitives';

import type { IStackProps } from '../../primitives';

type IAdCornerBadgeSize = 'sm' | 'lg';
type IAdCornerBadgePlacement = 'top-left' | 'top-right' | 'bottom-right';

const adCornerBadgeSizeMap: Record<
  IAdCornerBadgeSize,
  {
    offset: number;
    paddingX: number;
    paddingY: number;
    fontSize: number;
    lineHeight: number;
    bg: string;
    color: string;
  }
> = {
  sm: {
    offset: 2,
    paddingX: 3,
    paddingY: 0,
    fontSize: 8,
    lineHeight: 10,
    bg: 'rgba(255, 255, 255, 0.5)',
    color: 'rgba(0, 0, 0, 0.5)',
  },
  lg: {
    offset: 6,
    paddingX: 6,
    paddingY: 2,
    fontSize: 11,
    lineHeight: 13,
    bg: 'rgba(255, 255, 255, 0.65)',
    color: 'rgba(0, 0, 0, 0.65)',
  },
};

function BasicAdCornerBadge({
  badgeSize = 'sm',
  placement = 'top-right',
  ...rest
}: {
  badgeSize?: IAdCornerBadgeSize;
  placement?: IAdCornerBadgePlacement;
} & IStackProps) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: ETranslations.discovery_ad_label });
  const config = adCornerBadgeSizeMap[badgeSize];
  const isTopLeft = placement === 'top-left';
  const isBottomRight = placement === 'bottom-right';

  return (
    <Stack
      role="img"
      aria-label={label}
      position="absolute"
      top={isBottomRight ? undefined : config.offset}
      bottom={isBottomRight ? config.offset : undefined}
      left={isTopLeft ? config.offset : undefined}
      right={isTopLeft ? undefined : config.offset}
      paddingHorizontal={config.paddingX}
      paddingVertical={config.paddingY}
      borderRadius="$full"
      bg={config.bg}
      pointerEvents="none"
      zIndex={1}
      {...rest}
    >
      <SizableText
        allowFontScaling={false}
        color={config.color}
        fontWeight="500"
        fontSize={config.fontSize}
        lineHeight={config.lineHeight}
        letterSpacing={0}
        numberOfLines={1}
      >
        {label}
      </SizableText>
    </Stack>
  );
}

export const AdCornerBadge = memo(BasicAdCornerBadge);
