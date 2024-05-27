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
      <XStack space="$1">
        <NumberSizeableText
          size="$bodySmMedium"
          formatter="marketCap"
          formatterOptions={{ currency: '$' }}
        >
          {children}
        </NumberSizeableText>
        {rank ? (
          <SizableText
            size="$bodySm"
            bg="$bgStrong"
            color="$textSubdued"
            px="$1"
          >
            {`#${rank}`}
          </SizableText>
        ) : null}
      </XStack>
    </YStack>
  );
}
