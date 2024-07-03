import { useIntl } from 'react-intl';

import type { ITabPageProps } from '@onekeyhq/components';
import {
  Button,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const intl = useIntl();
  return (
    <YStack
      px="$5"
      $gtMd={{ px: 0 }}
      onLayout={({
        nativeEvent: {
          layout: { width, height },
        },
      }) => onContentSizeChange(width, height)}
    >
      <YStack py="$5" space="$2">
        <SizableText size="$headingSm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_community })}
        </SizableText>
        <XStack space="$3">
          {twitterUrl ? (
            <IconButton
              title="X"
              icon="Xbrand"
              onPress={() => openUrlExternal(twitterUrl)}
            />
          ) : null}
          {telegramUrl ? (
            <IconButton
              title="Telegram"
              icon="TelegramBrand"
              onPress={() => openUrlExternal(telegramUrl)}
            />
          ) : null}
          {discordUrl ? (
            <IconButton
              title="Discord"
              icon="DiscordBrand"
              onPress={() => openUrlExternal(discordUrl)}
            />
          ) : null}
        </XStack>
      </YStack>
      <YStack py="$5" space="$2">
        <SizableText size="$headingSm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_official_links })}
        </SizableText>
        <XStack space="$3">
          {homePageUrl ? (
            <Button
              icon="GlobusOutline"
              iconAfter="OpenOutline"
              onPress={() => openUrlExternal(homePageUrl)}
            >
              {intl.formatMessage({ id: ETranslations.global_website })}
            </Button>
          ) : null}
          {whitepaper ? (
            <Button
              icon="BookOpenOutline"
              iconAfter="OpenOutline"
              onPress={() => openUrlExternal(whitepaper)}
            >
              {intl.formatMessage({ id: ETranslations.global_white_paper })}
            </Button>
          ) : null}
        </XStack>
      </YStack>
      <YStack py="$5">
        <SizableText size="$headingSm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_explorers })}
        </SizableText>
        <XStack flexWrap="wrap">
          {explorers.map(({ url, name }) => (
            <Button
              mt="$2"
              mr="$3"
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
