import { useCallback, useEffect, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Carousel,
  Icon,
  IconButton,
  Image,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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
  const { gtSm, gtLg } = useMedia();

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
    <YStack
      pb="$3"
      $gtLg={{
        pt: '$3',
      }}
    >
      <Carousel
        loop={false}
        data={filteredBanners}
        autoPlayInterval={3800}
        containerStyle={{
          height: gtSm ? 86 : 76,
        }}
        paginationContainerStyle={{
          marginBottom: 0,
        }}
        onPageChanged={(index) => {
          if (filteredBanners[index]) {
            defaultLogger.wallet.walletBanner.walletBannerViewed({
              bannerId: filteredBanners[index].id,
            });
          }
        }}
        renderItem={({ item }: { item: IWalletBanner }) => {
          return (
            <YStack px="$5">
              <XStack
                key={item.id}
                flex={1}
                gap="$4"
                alignItems="center"
                p="$4"
                pr="$6"
                bg="$bg"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$borderSubdued"
                borderRadius="$2"
                borderCurve="continuous"
                elevation={0.5}
                {...(!gtLg && {
                  gap: '$3',
                  py: '$3',
                  pr: '$10',
                  hoverStyle: {
                    bg: '$bgHover',
                  },
                  pressStyle: {
                    bg: '$bgActive',
                  },
                  focusable: true,
                  focusVisibleStyle: {
                    outlineColor: '$focusRing',
                    outlineWidth: 2,
                    outlineStyle: 'solid',
                    outlineOffset: -2,
                  },
                  onPress: () => handleClick(item),
                })}
              >
                <Image
                  size="$12"
                  borderRadius="$1"
                  borderCurve="continuous"
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
                {gtSm ? (
                  <YStack gap="$0.5" flex={1}>
                    <SizableText size="$bodyLgMedium" numberOfLines={1}>
                      {item.title}
                    </SizableText>
                    <SizableText
                      size="$bodyMd"
                      color="$textSubdued"
                      numberOfLines={1}
                    >
                      {item.description}
                    </SizableText>
                  </YStack>
                ) : (
                  <SizableText size="$bodyMd" numberOfLines={2}>
                    {item.title}
                    <SizableText size="$bodyMd" color="$textSubdued" mx="$1">
                      -
                    </SizableText>
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {item.description}
                    </SizableText>
                  </SizableText>
                )}

                <XStack
                  gap="$5"
                  alignItems="center"
                  $lg={{
                    display: 'none',
                  }}
                >
                  {item.closeable ? (
                    <Button
                      size="small"
                      variant="tertiary"
                      onPress={() => handleDismiss(item)}
                      pointerEvents="auto"
                    >
                      {intl.formatMessage({
                        id: ETranslations.explore_dismiss,
                      })}
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    variant="primary"
                    onPress={() => handleClick(item)}
                    pointerEvents="auto"
                  >
                    {item.button ||
                      intl.formatMessage({
                        id: ETranslations.global_check_it_out,
                      })}
                  </Button>
                </XStack>

                <IconButton
                  position="absolute"
                  top="$2.5"
                  right="$2.5"
                  size="small"
                  variant="tertiary"
                  onPress={(event: GestureResponderEvent) => {
                    event.stopPropagation();
                    void handleDismiss(item);
                  }}
                  icon="CrossedSmallOutline"
                  $gtLg={{
                    display: 'none',
                  }}
                />
              </XStack>
            </YStack>
          );
        }}
      />
    </YStack>
  );
}

export default WalletBanner;
