import type { ITabPageProps } from '@onekeyhq/components';
import {
  Button,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

export function MarketDetailLinks({
  token: {
    links: { discordUrl, homePageUrl, telegramUrl, twitterUrl, whitepaper },
    explorers,
  },
  onContentSizeChange,
}: ITabPageProps & {
  token: IMarketTokenDetail;
}) {
  return (
    <YStack
      px="$5"
      onLayout={({
        nativeEvent: {
          layout: { width, height },
        },
      }) => onContentSizeChange(width, height)}
    >
      <YStack py="$5" space="$2">
        <SizableText size="$headingSm" color="$textSubdued">
          Community
        </SizableText>
        <XStack space="$3">
          {twitterUrl ? (
            <IconButton
              icon="Xbrand"
              onPress={() => openUrlExternal(twitterUrl)}
            />
          ) : null}
          {telegramUrl ? (
            <IconButton
              icon="TelegramBrand"
              onPress={() => openUrlExternal(telegramUrl)}
            />
          ) : null}
          {discordUrl ? (
            <IconButton
              icon="DiscordBrand"
              onPress={() => openUrlExternal(discordUrl)}
            />
          ) : null}
        </XStack>
      </YStack>
      <YStack py="$5" space="$2">
        <SizableText size="$headingSm" color="$textSubdued">
          Official Links
        </SizableText>
        <XStack space="$3">
          {homePageUrl ? (
            <Button
              icon="EarthOutline"
              iconAfter="OpenOutline"
              onPress={() => openUrlExternal(homePageUrl)}
            >
              Website
            </Button>
          ) : null}
          {whitepaper ? (
            <Button
              icon="BookOpenOutline"
              iconAfter="OpenOutline"
              onPress={() => openUrlExternal(whitepaper)}
            >
              White Paper
            </Button>
          ) : null}
        </XStack>
      </YStack>
      <YStack py="$5">
        <SizableText size="$headingSm" color="$textSubdued">
          Explorers
        </SizableText>
        <XStack flexWrap="wrap" space="$3">
          {explorers.map(({ url, name }) => (
            <Button
              mt="$2"
              key={url}
              iconAfter="OpenOutline"
              onPress={() => openUrlExternal(url)}
            >
              {name}
            </Button>
          ))}
        </XStack>
      </YStack>
    </YStack>
  );
}
