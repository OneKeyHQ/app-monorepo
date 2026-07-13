import { useMemo } from 'react';

import { SizableText } from '@tamagui/text';

import {
  createStyledContext,
  styled,
  withStaticProperties,
} from '@onekeyhq/components/src/shared/tamagui';
import type { GetProps } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { XStack } from '../../primitives/Stack';
import { TABULAR_NUMS, getFontVariantStyle } from '../../utils/tabularNums';

import type { IXStackProps } from '../../primitives';

export type IBadgeType =
  | 'success'
  | 'info'
  | 'warning'
  | 'critical'
  | 'default';

const BadgeContext = createStyledContext<{
  badgeSize: 'lg' | 'sm';
  badgeType: IBadgeType;
}>({
  badgeSize: 'sm',
  badgeType: 'default',
});

const BadgeFrame = styled(XStack, {
  name: 'BadgeFrame',
  context: BadgeContext,
  alignItems: 'center',
  paddingHorizontal: '$2',
  paddingVertical: '$0.5',
  borderRadius: '$1',
  borderCurve: 'continuous',
  maxWidth: '100%',
  variants: {
    badgeType: {
      success: {
        bg: '$bgSuccess',
      },
      info: {
        bg: '$bgInfo',
      },
      warning: {
        bg: '$bgCaution',
      },
      critical: {
        bg: '$bgCritical',
      },
      default: {
        bg: '$bgStrong',
      },
    },
    badgeSize: {
      lg: {},
      sm: {},
    },
  } as const,
});

const BadgeTextStyled = styled(SizableText, {
  name: 'BadgeText',
  allowFontScaling: false,
  numberOfLines: 1,
  context: BadgeContext,
  variants: {
    badgeSize: {
      lg: {
        size: '$bodyMdMedium',
      },
      sm: {
        size: '$bodySmMedium',
      },
    },
    badgeType: {
      success: {
        color: '$textSuccess',
      },
      info: {
        color: '$textInfo',
      },
      warning: {
        color: '$textCaution',
      },
      critical: {
        color: '$textCritical',
      },
      default: {
        color: '$textSubdued',
      },
    },
  } as const,
});

// Badge.Text is styled from raw tamagui text, so it bypasses the SizableText
// wrapper's app-wide tabular default. Re-apply it here (computed once) so badge
// digits (countdowns, rates, counts) stay equal-width on native. On web the
// web-fonts.css body rule already covers it, so getFontVariantStyle returns
// undefined and this is a passthrough.
const BADGE_TABULAR_STYLE = getFontVariantStyle(TABULAR_NUMS);

function BadgeText({ style, ...props }: GetProps<typeof BadgeTextStyled>) {
  // Merge (not overwrite) so a caller-provided `style` still wins.
  const mergedStyle = useMemo(
    () => (BADGE_TABULAR_STYLE ? [BADGE_TABULAR_STYLE, style] : style),
    [style],
  );
  return <BadgeTextStyled {...props} style={mergedStyle} />;
}

export type IBadgeProps = IXStackProps & {
  badgeType?: IBadgeType;
  badgeSize?: 'lg' | 'sm';
};

const BadgeComponent = BadgeFrame.styleable<IBadgeProps, any, any>(
  (props: IBadgeProps, ref: any) => {
    const { children } = props;

    const isString = typeof children === 'string';

    return (
      <BadgeFrame
        ref={ref}
        {...props}
        role={!platformEnv.isNative && props.onPress ? 'button' : undefined}
      >
        {!isString ? (
          children
        ) : (
          <BadgeText userSelect="none">{children}</BadgeText>
        )}
      </BadgeFrame>
    );
  },
);

export const Badge = withStaticProperties(BadgeComponent, {
  props: BadgeContext.Provider,
  Text: BadgeText,
});
