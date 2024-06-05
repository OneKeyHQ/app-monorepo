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
    <YStack flexBasis={0} flexGrow={1}>
      <SizableText size="$bodySm" color="$textSubdued">
        {title}
      </SizableText>
      <XStack space="$1" ai="center">
        <NumberSizeableText
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
