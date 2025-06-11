import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type {
  IKeyOfIcons,
  IRenderPaginationParams,
} from '@onekeyhq/components';
import {
  Divider,
  Icon,
  Page,
  SizableText,
  Stack,
  Swiper,
  Theme,
  XStack,
  YStack,
} from '@onekeyhq/components';
import CloseButton from '@onekeyhq/components/src/composite/Banner/CloseButton';
import { PaginationButton } from '@onekeyhq/components/src/composite/Banner/PaginationButton';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import type { IPrimeParamList } from '@onekeyhq/shared/src/routes/prime';

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
};

function FeaturesItem({
  banner,
  title,
  description,
  details,
}: IFeatureItemInfo) {
  return (
    <Stack pb="$5" alignItems="center" justifyContent="center">
      <Stack maxWidth={450} width="100%">
        <Stack alignItems="center" justifyContent="center">
          {banner}
        </Stack>
        <Stack pt="$4" px="$5">
          <SizableText textAlign="center" size="$headingXl">
            {title}
          </SizableText>
          <SizableText textAlign="center" size="$bodyLg" color="$textSubdued">
            {description}
          </SizableText>
        </Stack>
        <Divider my="$6" />
        {details.map((detail, index) => {
          return (
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
                    <SizableText textAlign="left" size="$bodyLgMedium">
                      {detail.title}
                    </SizableText>
                  </XStack>
                }
                secondary={detail.description}
              />
            </ListItem>
          );
        })}
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
  const intl = useIntl();

  const dataInfo = useMemo<{
    data: IFeatureItemInfo[];
    index: number;
  }>(() => {
    const allFeatures: IFeatureItemInfo[] = [
      {
        id: EPrimeFeatures.OneKeyCloud,
        banner: <Icon size="$20" name="OnekeyPrimeDarkColored" />,
        title: 'OneKey Cloud',
        description:
          'Automatically back up app usage data and synchronize seamlessly across devices.',
        details: [
          {
            icon: 'LinkOutline',
            title: 'Seamless Cross-Device Sync',
            description:
              'Sync your OneKey data instantly across desktop, mobile app, and more.',
          },
          {
            icon: 'ArchiveBoxOutline',
            title: 'Sync Key Data Types',
            description:
              'Covers wallet/account names, watch-only addresses, custom tokens/networks, etc.',
          },
        ],
      },

      {
        id: EPrimeFeatures.BulkCopyAddresses,
        banner: <Icon size="$20" name="OnekeyPrimeDarkColored" />,
        title: 'Bulk copy addresses',
        description: 'Easily select or generate addresses for bulk copying.',
        details: [
          {
            icon: 'OrganisationOutline',
            title: 'Wide Chain Support',
            description:
              'Export addresses for BTC, ETH, EVM & more, with flexible derivation paths.',
          },
          {
            icon: 'WalletCryptoOutline',
            title: 'All Wallet Compatible',
            description:
              'Batch export from all your software and hardware wallets.',
          },
          {
            icon: 'DownloadOutline',
            title: 'Full or Custom Export',
            description:
              'Export all addresses for a chosen network, or generate targeted custom ranges.',
          },
        ],
      },

      {
        id: EPrimeFeatures.DeviceManagement,
        banner: <Icon size="$20" name="OnekeyPrimeDarkColored" />,
        title: 'Device management',
        description: 'Access Prime on up to 5 devices.',
        details: [
          {
            icon: 'LinkOutline',
            title: 'Wide Chain Support',
            description:
              'Export addresses for BTC, ETH, EVM & more, with flexible derivation paths.',
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
  }, [selectedFeature, showAllFeatures]);

  const showPaginationButton = true;
  const showCloseButton = true;
  const isHovering = true;

  const renderPagination = useCallback(
    ({
      currentIndex,
      goToNextIndex,
      gotToPrevIndex,
    }: IRenderPaginationParams) => (
      <>
        {dataInfo.data.length > 1 ? (
          <XStack
            testID="prime-features-pagination"
            gap="$1"
            position="absolute"
            right={0}
            width="100%"
            jc="center"
            bottom="$2"
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
            />

            <PaginationButton
              isVisible={
                currentIndex !== dataInfo.data.length - 1 ? isHovering : false
              }
              direction="next"
              onPress={goToNextIndex}
            />
          </>
        ) : null}

        {showCloseButton ? (
          <CloseButton
            onPress={() => {
              //
            }}
            isHovering={isHovering}
          />
        ) : null}
      </>
    ),
    [dataInfo.data, isHovering, showCloseButton, showPaginationButton],
  );

  const [index, setIndex] = useState(dataInfo.index);
  const onIndexChange = useCallback(
    ({ index: newIndex }: { index: number }) => {
      setIndex(newIndex);
    },
    [],
  );

  const { isPrimeSubscriptionActive } = usePrimeAuthV2();
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

  return (
    <Page scrollEnabled>
      <Page.Header title="Prime Features" />
      <Page.Body>
        <Swiper
          height="100%"
          position="relative"
          index={index}
          onChangeIndex={onIndexChange}
          // autoplay
          // autoplayLoop
          // autoplayLoopKeepAnimation
          // autoplayDelayMs={3000}
          keyExtractor={keyExtractor}
          data={dataInfo.data}
          renderItem={renderItem}
          renderPagination={renderPagination}
          overflow="hidden"
          borderRadius="$3"
          onPointerEnter={() => {
            // setIsHoveringThrottled(true);
          }}
          onPointerLeave={() => {
            // setIsHoveringThrottled(false);
          }}
        />
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
            // return intl.formatMessage({
            //   id: ETranslations.prime_about_onekey_prime,
            // });
            return 'About OneKey Prime';
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
  );
}
