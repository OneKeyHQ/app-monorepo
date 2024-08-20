import { styled } from '@tamagui/core';
import { createStyledContext, withStaticProperties } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SizableText, XStack } from '../../primitives';

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

const BadgeText = styled(SizableText, {
  name: 'BadgeText',
  style: {
    wordBreak: 'break-all',
  },
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

const BadgeComponent = BadgeFrame.styleable((props, ref) => {
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
});

export const Badge = withStaticProperties(BadgeComponent, {
  props: BadgeContext.Provider,
  Text: BadgeText,
});
