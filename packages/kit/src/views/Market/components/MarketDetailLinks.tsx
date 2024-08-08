import { useIntl } from 'react-intl';

import type { ITabPageProps } from '@onekeyhq/components';
import {
  Button,
  IconButton,
  NestedScrollView,
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
}: ITabPageProps & {
  token: IMarketTokenDetail;
}) {
  const intl = useIntl();
  return (
    <NestedScrollView>
      <YStack px="$5" $gtMd={{ pr: 0 }}>
        <YStack py="$5" gap="$2">
          <SizableText size="$headingSm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_community })}
          </SizableText>
          <XStack gap="$3">
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
        <YStack py="$5" gap="$2">
          <SizableText size="$headingSm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_official_links })}
          </SizableText>
          <XStack gap="$3">
            {homePageUrl ? (
              <Button
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
        {
          explorers.length ? (
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
          ) : null
        }
      </YStack>
    </NestedScrollView>
  );
}
