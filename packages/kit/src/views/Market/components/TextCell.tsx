import type { INumberSizeableTextProps } from '@onekeyhq/components';
import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

export function TextCell({
  title,
  children,
  rank,
}: {
  title: string;
  rank?: number;
  children: INumberSizeableTextProps['children'];
}) {
  return (
    <YStack pr="$6" pt="$3">
      <SizableText size="$bodySm" color="$textSubdued">
        {title}
      </SizableText>
      <XStack space="$1" ai="center">
        <NumberSizeableText
          numberOfLines={1}
          size="$bodyMdMedium"
          formatter="marketCap"
          formatterOptions={{ currency: '$' }}
        >
          {children}
        </NumberSizeableText>
        {rank ? (
          <YStack px="$1" borderRadius="$1" bg="$bgStrong">
            <SizableText size="$bodySm" color="$textSubdued">
              {`#${rank}`}
            </SizableText>
          </YStack>
        ) : null}
      </XStack>
    </YStack>
  );
}
