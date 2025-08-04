import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import type {
  IKeyOfIcons,
  IRenderPaginationParams,
} from '@onekeyhq/components';
import {
  Button,
  Divider,
  Image,
  Page,
  Portal,
  SizableText,
  Stack,
  Swiper,
  Theme,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { PaginationButton } from '@onekeyhq/components/src/composite/Banner/PaginationButton';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePrimeCloudSyncPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import type { IPrimeParamList } from '@onekeyhq/shared/src/routes/prime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';
import { usePrimePayment } from '../../hooks/usePrimePayment';
import { usePrimeRequirements } from '../../hooks/usePrimeRequirements';

type IFeatureItemInfo = {
  id: EPrimeFeatures;
  banner: React.ReactNode;
  title: string;
  description: string;
  details: {
    icon: IKeyOfIcons;
    title: string;
    description: string;
    onPress?: () => void;
  }[];
  children?: React.ReactNode;
};

function FeaturesItem({
  banner,
  title,
  description,
  details,
  children,
}: IFeatureItemInfo) {
  return (
    <Stack alignItems="center" justifyContent="center">
      <Stack maxWidth={432} width="100%">
        <Stack alignItems="center" justifyContent="center">
          {banner}
        </Stack>
        <YStack pt="$4" px="$5" gap="$0.5">
          <SizableText textAlign="center" size="$headingXl">
            {title}
          </SizableText>
          <SizableText textAlign="center" size="$bodyLg" color="$textSubdued">
            {description}
          </SizableText>
        </YStack>
        <Divider my="$6" borderColor="$neutral3" />
        <YStack gap="$1.5" pb="$4">
          {details.map((detail, index) => {
            return (
              <>
                <ListItem
                  key={index}
                  drillIn={!!detail.onPress}
                  onPress={detail.onPress}
                  icon={detail.icon}
                >
                  <ListItem.Text
                    userSelect="none"
                    flex={1}
                    primary={
                      <XStack>
                        <SizableText textAlign="left" size="$bodyMdMedium">
                          {detail.title}
                        </SizableText>
                      </XStack>
                    }
                    secondary={detail.description}
                  />
                </ListItem>
              </>
            );
          })}
        </YStack>
        {children}
      </Stack>
    </Stack>
  );
}

export default function PagePrimeFeatures() {
  const navigation = useAppNavigation();
  const keyExtractor = useCallback((item: IFeatureItemInfo) => item.title, []);
  const renderItem = useCallback(({ item }: { item: IFeatureItemInfo }) => {
    return <FeaturesItem {...item} />;
  }, []);

  const route = useAppRoute<IPrimeParamList, EPrimePages.PrimeFeatures>();
  const selectedFeature = route.params?.selectedFeature;
  const showAllFeatures = route.params?.showAllFeatures;
  const selectedSubscriptionPeriod = route.params?.selectedSubscriptionPeriod;
  const serverUserInfo = route.params?.serverUserInfo;
  const intl = useIntl();
  const { gtMd } = useMedia();

  // const [primePersistData] = usePrimePersistAtom();
  // const [primeMasterPasswordPersistData] = usePrimeMasterPasswordPersistAtom();
  const { isPrimeSubscriptionActive } = usePrimeAuthV2();
  const [primeCloudSyncPersistData] = usePrimeCloudSyncPersistAtom();

  const { result: isServerMasterPasswordSet } = usePromiseResult(() => {
    return backgroundApiProxy.serviceMasterPassword.IsServerMasterPasswordSet({
      serverUserInfo,
    });
  }, [serverUserInfo]);

  const bannerHeight = useMemo(() => {
    if (gtMd) {
      return 200;
    }
    return 200;
  }, [gtMd]);

  const dataInfo = useMemo<{
    data: IFeatureItemInfo[];
    index: number;
  }>(() => {
    const allFeatures: IFeatureItemInfo[] = [
      {
        id: EPrimeFeatures.OneKeyCloud,
        banner: (
          <Image
            w="100%"
            h={bannerHeight}
            maxWidth={393}
            source={require('@onekeyhq/kit/assets/prime/onekey_cloud_banner.png')}
          />
        ),
        title: intl.formatMessage({
          id: ETranslations.global_onekey_cloud,
        }),
        description: intl.formatMessage({
          id: ETranslations.prime_onekey_cloud_desc,
        }),
        details: [
          {
            icon: 'LinkOutline',
            title: intl.formatMessage({
              id: ETranslations.prime_features_onekey_cloud_detail_one_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.prime_features_onekey_cloud_detail_one_desc,
            }),
          },
          {
            icon: 'ArchiveBoxOutline',
            title: intl.formatMessage({
              id: ETranslations.prime_features_onekey_cloud_detail_two_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.prime_features_onekey_cloud_detail_two_desc,
            }),
          },
        ],
        children:
          isServerMasterPasswordSet ||
          primeCloudSyncPersistData?.isCloudSyncEnabled ||
          isPrimeSubscriptionActive ? (
            <Stack>
              <Button
                mt="$2"
                variant="tertiary"
                onPress={() => {
                  navigation.navigate(EPrimePages.PrimeCloudSync, {
                    serverUserInfo,
                  });
                }}
              >
                {intl.formatMessage({
                  id: ETranslations.prime_manage_service,
                })}
              </Button>
            </Stack>
          ) : null,
      },

      {
        id: EPrimeFeatures.BulkCopyAddresses,
        banner: (
          <Image
            w="100%"
            h={bannerHeight}
            maxWidth={393}
            source={require('@onekeyhq/kit/assets/prime/bulk_copy_banner.png')}
          />
        ),
        title: intl.formatMessage({
          id: ETranslations.global_bulk_copy_addresses,
        }),
        description: intl.formatMessage({
          id: ETranslations.prime_bulk_copy_addresses_desc,
        }),
        details: [
          {
            icon: 'OrganisationOutline',
            title: intl.formatMessage({
              id: ETranslations.prime_features_bulk_copy_detail_one_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.prime_features_bulk_copy_detail_one_desc,
            }),
          },
          {
            icon: 'WalletCryptoOutline',
            title: intl.formatMessage({
              id: ETranslations.prime_features_bulk_copy_detail_two_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.prime_features_bulk_copy_detail_two_desc,
            }),
          },
          {
            icon: 'DownloadOutline',
            title: intl.formatMessage({
              id: ETranslations.prime_features_bulk_copy_detail_three_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.prime_features_bulk_copy_detail_three_desc,
            }),
          },
        ],
      },

      {
        id: EPrimeFeatures.BulkRevoke,
        banner: (
          <Image
            w="100%"
            h={bannerHeight}
            maxWidth={393}
            source={require('@onekeyhq/kit/assets/prime/bulk_revoke_banner.png')}
          />
        ),
        title: intl.formatMessage({
          id: ETranslations.global_bulk_revoke,
        }),
        description: intl.formatMessage({
          id: ETranslations.global_bulk_revoke_desc,
        }),
        details: [
          {
            icon: 'GasOutline',
            title: intl.formatMessage({
              id: ETranslations.prime_features_bulk_revoke_detail_two_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.prime_features_bulk_revoke_detail_two_desc,
            }),
          },
          {
            icon: 'WalletCryptoOutline',
            title: intl.formatMessage({
              id: ETranslations.prime_features_bulk_revoke_detail_one_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.prime_features_bulk_revoke_detail_one_desc,
            }),
          },
        ],
      },
    ];

    const selectedFeatureItem = allFeatures.find(
      (feature) => feature.id === selectedFeature,
    );

    const data = showAllFeatures
      ? allFeatures
      : [selectedFeatureItem].filter(Boolean);
    const index = data.findIndex((item) => item.id === selectedFeature);
    return {
      data,
      index: index ?? 0,
    };
  }, [
    bannerHeight,
    intl,
    isServerMasterPasswordSet,
    primeCloudSyncPersistData?.isCloudSyncEnabled,
    isPrimeSubscriptionActive,
    showAllFeatures,
    navigation,
    serverUserInfo,
    selectedFeature,
  ]);

  // PaginationButton will cause native crash
  const showPaginationButton = !platformEnv.isNative;
  const isHovering = true;
  const showCloseButton = false;

  const portalContainerName = useMemo(() => {
    return `prime-features-swiper-controls--${stringUtils.generateUUID()}`;
  }, []);

  const renderPagination = useCallback(
    ({
      currentIndex,
      goToNextIndex,
      gotToPrevIndex,
    }: IRenderPaginationParams) => (
      <Portal.Body container={portalContainerName as any}>
        <Theme name="dark">
          {dataInfo.data.length > 1 ? (
            <XStack
              testID="prime-features-pagination"
              gap="$1"
              position="absolute"
              right={0}
              left={0}
              bottom={0}
              width="100%"
              jc="center"
              // pt="$1"
              // pb="$2"
              zIndex={1}
              // {...hoverOpacity}
              // {...indicatorContainerStyle}
            >
              {dataInfo.data.map((_, index) => (
                <Stack
                  key={index}
                  w="$3"
                  $gtMd={{
                    w: '$4',
                  }}
                  h="$1"
                  borderRadius="$full"
                  bg="$textSubdued"
                  opacity={currentIndex === index ? 1 : 0.5}
                />
              ))}
            </XStack>
          ) : null}

          {showPaginationButton ? (
            <>
              <PaginationButton
                isVisible={currentIndex !== 0 ? isHovering : false}
                direction="previous"
                onPress={gotToPrevIndex}
                variant="tertiary"
                zIndex={1}
                theme="dark"
                iconSize="small"
                positionOffset={16}
              />

              <PaginationButton
                isVisible={
                  currentIndex !== dataInfo.data.length - 1 ? isHovering : false
                }
                direction="next"
                onPress={goToNextIndex}
                variant="tertiary"
                zIndex={1}
                theme="dark"
                iconSize="small"
                positionOffset={16}
              />
            </>
          ) : null}
        </Theme>
      </Portal.Body>
    ),
    [dataInfo.data, isHovering, portalContainerName, showPaginationButton],
  );

  const [index, setIndex] = useState(dataInfo.index);

  const shouldShowConfirmButton = !showAllFeatures
    ? true
    : !isPrimeSubscriptionActive;

  const [isSubscribeLazyLoading, setIsSubscribeLazyLoading] = useState(false);
  const isSubscribeLazyLoadingRef = useRef(isSubscribeLazyLoading);
  isSubscribeLazyLoadingRef.current = isSubscribeLazyLoading;

  const { ensurePrimeSubscriptionActive } = usePrimeRequirements();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { getPackagesNative, restorePurchases, getPackagesWeb } =
    usePrimePayment();

  const { result: packages, isLoading: isPackagesLoading } = usePromiseResult(
    async () => {
      const pkgList = await (platformEnv.isNative
        ? getPackagesNative?.()
        : getPackagesWeb?.());
      return pkgList;
    },
    [getPackagesNative, getPackagesWeb],
    {
      watchLoading: true,
    },
  );

  const selectedPackage = useMemo(() => {
    return packages?.find(
      (p) => p.subscriptionPeriod === selectedSubscriptionPeriod,
    );
  }, [packages, selectedSubscriptionPeriod]);

  const subscribe = useCallback(async () => {
    if (!showAllFeatures) {
      navigation.pushModal(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeDashboard,
      });
      return;
    }
    if (isPackagesLoading) {
      return;
    }
    if (isSubscribeLazyLoadingRef.current) {
      return;
    }
    setIsSubscribeLazyLoading(true);
    setTimeout(() => {
      setIsSubscribeLazyLoading(false);
    }, 2000);

    // await ensureOneKeyIDLoggedIn({
    //   skipDialogConfirm: true,
    // });
    await ensurePrimeSubscriptionActive({
      skipDialogConfirm: true,
      selectedSubscriptionPeriod,
    });
  }, [
    ensurePrimeSubscriptionActive,
    isPackagesLoading,
    navigation,
    selectedSubscriptionPeriod,
    showAllFeatures,
  ]);

  const { height: windowHeight } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const height = useMemo(() => {
    if (platformEnv.isNative) {
      const TAB_BAR_HEIGHT = 54;
      return windowHeight - top - bottom - TAB_BAR_HEIGHT - 120;
    }
    return '100%';
  }, [windowHeight, top, bottom]);

  const page = (
    <>
      <Page.BackButton />
      <Page>
        <Theme name="dark">
          <Page.Header
            headerShown={false}
            title={intl.formatMessage({
              id: ETranslations.prime_features_title,
            })}
          />
        </Theme>

        <Page.Body>
          <View style={{ flex: 1 }}>
            <Portal.Container name={portalContainerName} />
            <ScrollView>
              <Stack h={gtMd ? 48 : 60} />
              <Swiper
                // height={height}
                height="100%"
                position="relative"
                index={index}
                initialNumToRender={3}
                onChangeIndex={({ index: newIndex }) => setIndex(newIndex)}
                keyExtractor={keyExtractor}
                data={dataInfo.data}
                renderItem={renderItem}
                renderPagination={renderPagination}
                overflow="hidden"
                borderRadius="$3"
              />
            </ScrollView>
          </View>
        </Page.Body>
        <Page.Footer
          confirmButtonProps={
            shouldShowConfirmButton
              ? {
                  loading: !showAllFeatures ? false : isSubscribeLazyLoading,
                  disabled: !showAllFeatures ? false : isPackagesLoading,
                }
              : undefined
          }
          onConfirm={shouldShowConfirmButton ? subscribe : undefined}
          onConfirmText={(() => {
            if (!showAllFeatures) {
              return intl.formatMessage({
                id: ETranslations.prime_about_onekey_prime,
              });
            }

            if (!packages?.length) {
              return intl.formatMessage({
                id: ETranslations.prime_subscribe,
              });
            }

            return selectedSubscriptionPeriod === 'P1Y'
              ? intl.formatMessage(
                  {
                    id: ETranslations.prime_subscribe_yearly_price,
                  },
                  {
                    price: selectedPackage?.pricePerYearString,
                  },
                )
              : intl.formatMessage(
                  {
                    id: ETranslations.prime_subscribe_monthly_price,
                  },
                  {
                    price: selectedPackage?.pricePerMonthString,
                  },
                );
          })()}
        />
      </Page>
    </>
  );

  return <Theme name="dark">{page}</Theme>;
  // return page;
}
