import type { ReactNode } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

// Shared label/value row for the review breakdown and the success page's
// order card — one definition so the two surfaces can't drift.
export function DetailRow({
  label,
  children,
  py,
  onPress,
}: {
  label: string;
  children: ReactNode;
  py?: '$2';
  onPress?: () => void;
}) {
  return (
    <XStack
      py={py}
      jc="space-between"
      ai="center"
      onPress={onPress}
      {...(onPress
        ? {
            hoverStyle: { bg: '$bgHover' },
            cursor: 'pointer' as const,
          }
        : {})}
    >
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      {children}
    </XStack>
  );
}

export function formatPrice(value: number) {
  return numberFormat(String(value), {
    formatter: 'price',
    formatterOptions: { currency: '$' },
  });
}
