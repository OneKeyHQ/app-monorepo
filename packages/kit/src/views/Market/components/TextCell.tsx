import type { INumberSizeableTextProps } from '@onekeyhq/components';
import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function TextCell({
  title,
  children,
  rank,
}: {
  title: string;
  rank?: number;
  children: INumberSizeableTextProps['children'];
}) {
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  return (
    <YStack pt="$3">
      <SizableText size="$bodySm" color="$textSubdued">
        {title}
      </SizableText>
      <XStack space="$1" ai="center">
        <NumberSizeableText
          numberOfLines={1}
          size="$bodyMdMedium"
          formatter="marketCap"
          formatterOptions={{ currency }}
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
