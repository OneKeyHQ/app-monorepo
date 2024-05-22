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
    links: { discordUrl, homePageUrl, telegramUrl, twitterUrl },
  },
}: {
  token: IMarketTokenDetail;
}) {
  return (
    <YStack px="$5">
      <YStack py="$5" space="$2">
        <SizableText size="$headingSm" color="$textSubdued">
          Community
        </SizableText>
        <XStack space="$3">
          {twitterUrl ? (
            <IconButton
              icon="TelegramBrand"
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
          <Button icon="BookOpenOutline" iconAfter="OpenOutline">
            White Paper
          </Button>
        </XStack>
      </YStack>
      <YStack py="$5" space="$2">
        <SizableText size="$headingSm" color="$textSubdued">
          Explorers
        </SizableText>
        <XStack>
          <Button iconAfter="OpenOutline">Etherscan</Button>
        </XStack>
      </YStack>
    </YStack>
  );
}
