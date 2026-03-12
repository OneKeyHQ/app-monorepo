import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IIconProps } from '@onekeyhq/components';
import {
  Carousel,
  Icon,
  Image,
  SizableText,
  Stack,
  Theme,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  ONEKEY_SIFU_URL,
  ONEKEY_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { appendUtmSourceToUrl } from '@onekeyhq/shared/src/utils/uriUtils';

import { RichBlock } from '../RichBlock';

function SupportHubItem({
  icon,
  title,
  link,
  onPress,
}: {
  icon: IIconProps['name'];
  title: string;
  link?: string;
  onPress?: () => void;
}) {
  return (
    <XStack
      alignItems="center"
      gap="$2"
      px="$4"
      py="$3"
      bg="$bgSubdued"
      justifyContent="space-between"
      flex={1}
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      onPress={
        link
          ? () => {
              if (platformEnv.isDesktop || platformEnv.isNative) {
                openUrlInDiscovery({ url: link });
              } else {
                openUrlExternal(link);
              }
            }
          : onPress
      }
    >
      <XStack alignItems="center" gap="$2.5" flex={1}>
        <Stack borderRadius="$full" p="$2" bg="$bgStrong">
          <Icon name={icon} size="$6" />
        </Stack>
        <SizableText size="$bodyMdMedium">{title}</SizableText>
      </XStack>
      {link && (platformEnv.isWeb || platformEnv.isExtension) ? (
        <Stack width="$4" height="$4">
          <Icon name="ArrowTopRightOutline" size="$4" color="$iconSubdued" />
        </Stack>
      ) : null}
    </XStack>
  );
}

type ISupportHubBanner = {
  image: any;
  title: ETranslations;
  description: ETranslations;
  url: string;
};

function SupportHubBannerItem({
  item,
  themeVariant,
  intl,
}: {
  item: ISupportHubBanner;
  themeVariant: string;
  intl: ReturnType<typeof useIntl>;
}) {
  return (
    <YStack
      height={151}
      justifyContent="center"
      px="$4"
      position="relative"
      onPress={() => {
        if (platformEnv.isDesktop || platformEnv.isNative) {
          openUrlInDiscovery({ url: item.url });
        } else {
          openUrlExternal(item.url);
        }
      }}
    >
      <Stack
        position="absolute"
        top="0"
        left="0"
        bottom="0"
        right="0"
        pointerEvents="none"
      >
        <Image
          position="absolute"
          top="0"
          left="0"
          bottom="0"
          right="0"
          source={item.image}
          resizeMode="cover"
          zIndex={0}
          opacity={themeVariant === 'dark' ? 0.9 : 1}
        />
      </Stack>
      <Theme name="light">
        <YStack width="60%" zIndex={99} position="absolute" left="$4">
          <SizableText size="$headingLg" flex={1}>
            {intl.formatMessage({ id: item.title })}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
            {intl.formatMessage({ id: item.description })}
          </SizableText>
        </YStack>
      </Theme>
    </YStack>
  );
}

function SupportHub() {
  const intl = useIntl();
  const themeVariant = useThemeVariant();
  const [devSettings] = useDevSettingsPersistAtom();

  const helpCenterCommonFaqLink = useHelpLink({
    path: '',
  });

  const supportHubUtmSource = 'app_support_hub';

  const quizChallengeUrl = useMemo(() => {
    const isTestEnv =
      devSettings.enabled && devSettings.settings?.enableTestEndpoint;
    const baseUrl = isTestEnv ? 'https://onekeytest.com' : ONEKEY_URL;
    return appendUtmSourceToUrl({
      url: `${baseUrl}/quiz-challenge`,
      utmSource: supportHubUtmSource,
    });
  }, [
    devSettings.enabled,
    devSettings.settings?.enableTestEndpoint,
    supportHubUtmSource,
  ]);

  const sifuUrl = useMemo(
    () =>
      appendUtmSourceToUrl({
        url: ONEKEY_SIFU_URL,
        utmSource: supportHubUtmSource,
      }),
    [supportHubUtmSource],
  );

  const bannerData = useMemo<ISupportHubBanner[]>(
    () => [
      {
        image: require('@onekeyhq/kit/assets/web3_quiz_challange_bg.jpg'),
        title: ETranslations.quiz_time__title,
        description: ETranslations.quiz_time__desc,
        url: quizChallengeUrl,
      },
      {
        image: require('@onekeyhq/kit/assets/sifu_bg.jpg'),
        title: ETranslations.wallet_onekey_sifu,
        description:
          ETranslations.wallet_get_one_on_one_hardware_wallet_setup_help,
        url: sifuUrl,
      },
    ],
    [quizChallengeUrl, sifuUrl],
  );

  const [bannerWidth, setBannerWidth] = useState(0);

  const renderBannerItem = useCallback(
    ({ item }: { item: ISupportHubBanner }) => (
      <SupportHubBannerItem
        item={item}
        themeVariant={themeVariant}
        intl={intl}
      />
    ),
    [themeVariant, intl],
  );

  const renderContent = useCallback(() => {
    return (
      <Stack flexDirection="row" $md={{ flexDirection: 'column' }} gap="$3">
        <Stack
          flex={1}
          $gtMd={{ flexBasis: 0 }}
          overflow="hidden"
          onLayout={(e) => setBannerWidth(e.nativeEvent.layout.width)}
        >
          <RichBlock
            content={
              bannerWidth > 0 ? (
                <Carousel
                  data={bannerData}
                  renderItem={renderBannerItem}
                  pageWidth={bannerWidth}
                  autoPlayInterval={5000}
                  loop={bannerData.length > 1}
                  showPagination={bannerData.length > 1}
                  containerStyle={{
                    height: 151,
                  }}
                  paginationContainerStyle={{
                    position: 'absolute',
                    bottom: 8,
                    left: 0,
                    right: 0,
                    gap: 0,
                  }}
                />
              ) : (
                <Stack height={151} />
              )
            }
            contentContainerProps={{
              px: '$0',
              py: '$0',
              outlineWidth: 1,
              outlineStyle: 'solid',
              outlineColor: '$neutral2',
              overflow: 'hidden',
            }}
          />
        </Stack>
        <Stack
          flexDirection="column"
          gap="$3"
          flex={1}
          $gtMd={{ flexBasis: 0 }}
        >
          <RichBlock
            blockContainerProps={{
              flex: 1,
            }}
            content={
              <SupportHubItem
                icon="HelpSupportOutline"
                title={intl.formatMessage({
                  id: ETranslations.global_contact_us,
                })}
                onPress={() => {
                  void showIntercom();
                }}
              />
            }
            contentContainerProps={{
              px: '$0',
              py: '$0',
              flex: 1,
            }}
          />
          <RichBlock
            blockContainerProps={{
              flex: 1,
            }}
            content={
              <SupportHubItem
                icon="BookOpenOutline"
                title={intl.formatMessage({
                  id: ETranslations.settings_help_center,
                })}
                link={helpCenterCommonFaqLink}
              />
            }
            contentContainerProps={{
              px: '$0',
              py: '$0',
              flex: 1,
            }}
          />
        </Stack>
      </Stack>
    );
  }, [
    intl,
    helpCenterCommonFaqLink,
    bannerData,
    renderBannerItem,
    bannerWidth,
  ]);

  return (
    <RichBlock
      title={intl.formatMessage({ id: ETranslations.settings_support_hub })}
      headerContainerProps={{ px: '$pagePadding' }}
      content={renderContent()}
      contentContainerProps={{ px: '$pagePadding' }}
      plainContentContainer
    />
  );
}

export { SupportHub };
