import { useCallback, useEffect, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  Button,
  Carousel,
  Icon,
  IconButton,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import type { GestureResponderEvent } from 'react-native';

function WalletBanner() {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });

  const intl = useIntl();

  const { md, gtMd } = useMedia();

  const [closedForeverBanners, setClosedForeverBanners] = useState<
    Record<string, boolean>
  >({});

  const { result: banners } = usePromiseResult(
    async () => {
      if (isNil(account?.id)) {
        return [];
      }
      return backgroundApiProxy.serviceWalletBanner.fetchWalletBanner({
        accountId: account.id,
      });
    },
    [account?.id],
    {
      initResult: [],
    },
  );

  const { result: filteredBanners } = usePromiseResult(
    async () => {
      if (banners.length === 0) {
        return banners;
      }

      return banners.filter((banner) => !closedForeverBanners[banner.id]);
    },
    [banners, closedForeverBanners],
    {
      initResult: [],
    },
  );

  const handleDismiss = useCallback(async (item: IWalletBanner) => {
    if (item.closeable) {
      setClosedForeverBanners((prev) => ({
        ...prev,
        [item.id]: true,
      }));
      defaultLogger.wallet.walletBanner.walletBannerClicked({
        bannerId: item.id,
        type: 'close',
      });
      if (item.closeForever) {
        await backgroundApiProxy.serviceWalletBanner.updateClosedForeverBanners(
          {
            bannerId: item.id,
            closedForever: true,
          },
        );
      }
    }
  }, []);

  const handleClick = useCallback((item: IWalletBanner) => {
    defaultLogger.wallet.walletBanner.walletBannerClicked({
      bannerId: item.id,
      type: 'jump',
    });
    if (item.hrefType === 'external') {
      openUrlExternal(item.href);
    } else {
      openUrlInApp(item.href);
    }
  }, []);

  useEffect(() => {
    const fetchClosedForeverBanners = async () => {
      const resp =
        await backgroundApiProxy.serviceWalletBanner.getClosedForeverBanners();
      setClosedForeverBanners(resp);
    };
    void fetchClosedForeverBanners();
  }, []);

  if (filteredBanners.length === 0) {
    return null;
  }

  return (
    <Stack px="$5">
      <Carousel
        data={filteredBanners}
        autoPlayInterval={3800}
        containerStyle={{
          height: 96,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '$borderSubdued',
          borderRadius: '$4',
          overflow: 'hidden',
        }}
        paginationContainerStyle={{
          marginBottom: 0,
        }}
        renderItem={({ item }: { item: IWalletBanner }) => {
          return (
            <XStack
              key={item.id}
              bg="$bgApp"
              px="$4"
              flex={1}
              jc="space-between"
              ai="center"
              onPress={gtMd ? undefined : () => handleClick(item)}
              gap="$5"
            >
              <XStack gap="$5" alignItems="center" flex={1}>
                <Image
                  size="$16"
                  borderRadius="$2.5"
                  source={{ uri: item.src }}
                  fallback={
                    <Image.Fallback
                      w="100%"
                      h="100%"
                      borderRadius="$2.5"
                      bg="$bgStrong"
                      justifyContent="center"
                      alignItems="center"
                    >
                      <Icon
                        name="ImageSquareWavesOutline"
                        color="$iconDisabled"
                      />
                    </Image.Fallback>
                  }
                />
                <YStack gap="$0.5" flex={1}>
                  <SizableText size="$bodyLgMedium" numberOfLines={1}>
                    {item.title}
                  </SizableText>
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    numberOfLines={2}
                    flexShrink={1}
                  >
                    {item.description}
                  </SizableText>
                </YStack>
              </XStack>
              {gtMd ? (
                <XStack gap="$5">
                  {item.closeable ? (
                    <Button
                      variant="tertiary"
                      onPress={() => handleDismiss(item)}
                    >
                      {intl.formatMessage({
                        id: ETranslations.explore_dismiss,
                      })}
                    </Button>
                  ) : null}
                  <Button variant="primary" onPress={() => handleClick(item)}>
                    {item.button}
                  </Button>
                </XStack>
              ) : null}
              {md && item.closeable ? (
                <Stack height="100%" position="relative">
                  <IconButton
                    size="small"
                    variant="tertiary"
                    onPress={(event: GestureResponderEvent) => {
                      event.stopPropagation();
                      void handleDismiss(item);
                    }}
                    icon="CrossedSmallOutline"
                    mt="$3"
                  />
                </Stack>
              ) : null}
            </XStack>
          );
        }}
        onPageChanged={(index) => {
          if (filteredBanners[index]) {
            defaultLogger.wallet.walletBanner.walletBannerViewed({
              bannerId: filteredBanners[index].id,
            });
          }
        }}
      />
    </Stack>
  );
}

export default WalletBanner;
