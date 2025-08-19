import { useCallback, useEffect, useState } from 'react';

import { isNil } from 'lodash';
import { StyleSheet } from 'react-native';

import {
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
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EQRCodeHandlerNames } from '@onekeyhq/shared/types/qrCode';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import { EarnNavigation } from '../../../Earn/earnUtils';
import useParseQRCode from '../../../ScanQrCode/hooks/useParseQRCode';

import type { GestureResponderEvent } from 'react-native';

const closedBanners: Record<string, boolean> = {};

function WalletBanner() {
  const {
    activeAccount: { account, network, wallet, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const { gtSm } = useMedia();
  const themeVariant = useThemeVariant();

  const navigation = useAppNavigation();

  const parseQRCode = useParseQRCode();

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
      closedBanners[item.id] = true;
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

  const handleClick = useCallback(
    async (item: IWalletBanner) => {
      defaultLogger.wallet.walletBanner.walletBannerClicked({
        bannerId: item.id,
        type: 'jump',
      });
      if (item.hrefType === 'internal' && item.href.includes('/defi/staking')) {
        const [path, query] = item.href.split('?');
        const paths = path.split('/');
        const provider = paths.pop();
        const symbol = paths.pop();
        const params = new URLSearchParams(query);
        const networkId = params.get('networkId');
        const vault = params.get('vault');
        if (provider && symbol && networkId) {
          const earnAccount =
            await backgroundApiProxy.serviceStaking.getEarnAccount({
              indexedAccountId: indexedAccount?.id,
              accountId: account?.id ?? '',
              networkId,
            });
          const navigationParams: {
            accountId?: string;
            networkId: string;
            indexedAccountId?: string;
            symbol: string;
            provider: string;
            vault?: string;
          } = {
            accountId: earnAccount?.accountId || account?.id || '',
            indexedAccountId:
              earnAccount?.account.indexedAccountId || indexedAccount?.id,
            provider,
            symbol,
            networkId,
          };
          if (vault) {
            navigationParams.vault = vault;
          }
          void EarnNavigation.pushDetailPageFromDeeplink(
            navigation,
            navigationParams,
          );
        }
        return;
      }

      await parseQRCode.parse(item.href, {
        handlers: [
          EQRCodeHandlerNames.marketDetail,
          EQRCodeHandlerNames.sendProtection,
          EQRCodeHandlerNames.rewardCenter,
        ],
        qrWalletScene: false,
        autoHandleResult: true,
        defaultHandler: openUrlExternal,
        account,
        network,
        wallet,
      });
    },
    [account, indexedAccount?.id, navigation, network, parseQRCode, wallet],
  );

  useEffect(() => {
    const fetchClosedForeverBanners = async () => {
      const resp =
        await backgroundApiProxy.serviceWalletBanner.getClosedForeverBanners();
      setClosedForeverBanners({
        ...closedBanners,
        ...resp,
      });
    };
    void fetchClosedForeverBanners();
  }, []);

  const { gtMd } = useMedia();

  if (filteredBanners.length === 0) {
    return null;
  }

  return (
    <YStack py="$2.5" bg="$bgApp">
      <Carousel
        loop={false}
        marginRatio={gtMd ? 0.28 : 0}
        data={filteredBanners}
        autoPlayInterval={3800}
        maxPageWidth={840}
        containerStyle={{
          height: gtSm ? 98 : 90,
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
            <YStack
              px="$5"
              pt="$0.5"
              $platform-native={{
                h: gtSm ? 82 : 73,
              }}
            >
              <XStack
                key={item.id}
                flex={1}
                gap="$4"
                alignItems="center"
                p="$4"
                pr="$10"
                bg="$bg"
                $lg={{
                  gap: '$3',
                  py: '$3',
                }}
                borderRadius="$2"
                $platform-native={{
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: '$borderSubdued',
                  borderCurve: 'continuous',
                }}
                $platform-android={{ elevation: 0.5 }}
                $platform-ios={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 0.5 },
                  shadowOpacity: 0.2,
                  shadowRadius: 0.5,
                }}
                $platform-web={{
                  boxShadow:
                    '0 8px 12px -4px rgba(0, 0, 0, 0.08), 0 0 2px 0 rgba(0, 0, 0, 0.10), 0 1px 2px 0 rgba(0, 0, 0, 0.10)',
                  ...(themeVariant === 'dark' && {
                    borderWidth: 1,
                    borderColor: '$borderSubdued',
                  }),
                }}
                hoverStyle={{
                  bg: '$bgHover',
                }}
                pressStyle={{
                  bg: '$bgActive',
                }}
                focusable
                focusVisibleStyle={{
                  outlineColor: '$focusRing',
                  outlineWidth: 2,
                  outlineStyle: 'solid',
                  outlineOffset: -2,
                }}
                onPress={() => handleClick(item)}
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
                    <SizableText size="$bodyLgMedium" numberOfLines={2}>
                      {item.title}
                    </SizableText>
                    {item.description ? (
                      <SizableText
                        size="$bodyMd"
                        color="$textSubdued"
                        numberOfLines={1}
                      >
                        {item.description}
                      </SizableText>
                    ) : null}
                  </YStack>
                ) : (
                  <SizableText size="$bodyMdMedium" flex={1} numberOfLines={2}>
                    {item.title}
                    {item.description ? (
                      <>
                        <SizableText size="$bodyMd" color="$textSubdued">
                          {' '}
                          -{' '}
                        </SizableText>
                        <SizableText size="$bodyMd" color="$textSubdued">
                          {item.description}
                        </SizableText>
                      </>
                    ) : null}
                  </SizableText>
                )}

                {/* <XStack
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
                </XStack> */}

                {item.closeable ? (
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
                  />
                ) : null}
              </XStack>
            </YStack>
          );
        }}
      />
    </YStack>
  );
}

export default WalletBanner;
