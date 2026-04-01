import { DashText, SizableText, XStack, YStack } from '@onekeyhq/components';

import type { IDescriptionRow } from '../hooks/useStockSecurityStats';

export function StockDescriptionRows({ rows }: { rows: IDescriptionRow[] }) {
  return (
    <YStack gap="$2.5">
      {rows.map((item) => (
        <XStack key={item.key} gap="$2" jc="space-between" ai="center">
          <DashText
            size="$bodySm"
            color="$textSubdued"
            dashColor="$textDisabled"
            dashThickness={0.5}
          >
            {item.label}
          </DashText>
          <SizableText size="$bodySmMedium" color="$text">
            {item.value}
          </SizableText>
        </XStack>
      ))}
    </YStack>
  );
}
