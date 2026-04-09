import { DashText, SizableText, XStack, YStack } from '@onekeyhq/components';

import type { IDescriptionRow } from '../hooks/useStockSecurityStats';

export function StockDescriptionRows({ rows }: { rows: IDescriptionRow[] }) {
  return (
    <YStack gap="$2.5">
      {rows.map((item) => (
        <XStack key={item.key} gap="$2" jc="space-between" ai="center">
          {item.tooltip ? (
            <DashText
              size="$bodySm"
              color="$textSubdued"
              dashColor="$textDisabled"
              dashThickness={0.5}
              tooltip={item.tooltip}
              tooltipTitle={item.label}
            >
              {item.label}
            </DashText>
          ) : (
            <SizableText size="$bodySm" color="$textSubdued">
              {item.label}
            </SizableText>
          )}
          <SizableText size="$bodySmMedium" color="$text">
            {item.value}
          </SizableText>
        </XStack>
      ))}
    </YStack>
  );
}
