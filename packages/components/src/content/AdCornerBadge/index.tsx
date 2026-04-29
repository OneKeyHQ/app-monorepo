import { SizableText, Stack } from '../../primitives';

import type { ISizableTextProps, IStackProps } from '../../primitives';

type IAdCornerBadgeSize = 'sm' | 'lg';
type IAdCornerBadgePlacement = 'top-left' | 'top-right';

const adCornerBadgeSizeMap: Record<
  IAdCornerBadgeSize,
  {
    containerSize: number;
    ribbonEdge: number;
    ribbonHeight: number;
    ribbonTop: number;
    ribbonWidth: number;
    textSize: ISizableTextProps['size'];
  }
> = {
  sm: {
    containerSize: 36,
    ribbonEdge: -24,
    ribbonHeight: 15,
    ribbonTop: 1,
    ribbonWidth: 66,
    textSize: '$bodyXsMedium',
  },
  lg: {
    containerSize: 60,
    ribbonEdge: -36,
    ribbonHeight: 22,
    ribbonTop: 5,
    ribbonWidth: 112,
    textSize: '$bodySmMedium',
  },
};

export function AdCornerBadge({
  badgeSize = 'sm',
  placement = 'top-right',
  ...rest
}: {
  badgeSize?: IAdCornerBadgeSize;
  placement?: IAdCornerBadgePlacement;
} & IStackProps) {
  const config = adCornerBadgeSizeMap[badgeSize];
  const isTopLeft = placement === 'top-left';

  return (
    <Stack
      position="absolute"
      top={0}
      {...(isTopLeft ? { left: 0 } : { right: 0 })}
      width={config.containerSize}
      height={config.containerSize}
      overflow="hidden"
      pointerEvents="none"
      zIndex={1}
      {...rest}
    >
      <Stack
        position="absolute"
        top={config.ribbonTop}
        {...(isTopLeft
          ? { left: config.ribbonEdge }
          : { right: config.ribbonEdge })}
        width={config.ribbonWidth}
        height={config.ribbonHeight}
        rotate={isTopLeft ? '-45deg' : '45deg'}
        alignItems="center"
        justifyContent="center"
        bg="rgba(255, 255, 255, 0.78)"
        borderWidth={0.5}
        borderColor="rgba(0, 0, 0, 0.06)"
      >
        <SizableText
          allowFontScaling={false}
          color="$textSubduedLight"
          fontWeight="600"
          letterSpacing={0}
          lineHeight={config.ribbonHeight}
          numberOfLines={1}
          size={config.textSize}
        >
          AD
        </SizableText>
      </Stack>
    </Stack>
  );
}
