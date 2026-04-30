import { memo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SizableText, Stack } from '../../primitives';

import type { IStackProps } from '../../primitives';

type IAdCornerBadgeSize = 'sm' | 'lg';
type IAdCornerBadgePlacement = 'top-left' | 'top-right';

const adCornerBadgeSizeMap: Record<
  IAdCornerBadgeSize,
  {
    offset: number;
    paddingX: number;
    paddingY: number;
    fontSize: number;
    lineHeight: number;
  }
> = {
  sm: {
    offset: 3,
    paddingX: 4,
    paddingY: 1,
    fontSize: 9,
    lineHeight: 11,
  },
  lg: {
    offset: 6,
    paddingX: 6,
    paddingY: 2,
    fontSize: 11,
    lineHeight: 13,
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

  return (
    <Stack
      role="img"
      aria-label={label}
      position="absolute"
      top={config.offset}
      left={isTopLeft ? config.offset : undefined}
      right={isTopLeft ? undefined : config.offset}
      paddingHorizontal={config.paddingX}
      paddingVertical={config.paddingY}
      borderRadius="$full"
      bg="rgba(255, 255, 255, 0.65)"
      pointerEvents="none"
      zIndex={1}
      {...rest}
    >
      <SizableText
        allowFontScaling={false}
        color="rgba(0, 0, 0, 0.65)"
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
