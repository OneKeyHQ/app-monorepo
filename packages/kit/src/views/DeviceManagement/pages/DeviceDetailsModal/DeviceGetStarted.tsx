import { useIntl } from 'react-intl';

import {
  Button,
  Carousel,
  Divider,
  Icon,
  Image,
  LinearGradient,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { HELP_CENTER_HARDWARE_FAQ_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { parseNotificationPayload } from '@onekeyhq/shared/src/utils/notificationsUtils';
import { openUrlInDiscovery } from '@onekeyhq/shared/src/utils/openUrlUtils';

function DeviceBanner() {
  const { result: getStartedItems } = usePromiseResult(
    async () => {
      const response =
        await backgroundApiProxy.serviceSetting.fetchGetStartedLinks({
          slots: ['hardware_getstarteds'],
        });
      return response;
    },
    [],
    {
      initResult: [],
      watchLoading: true,
    },
  );

  const handleOpen = (item: { mode: number; payload: string }) => {
    parseNotificationPayload(item.mode, item.payload, () => {});
  };

  return (
    <YStack gap="$3">
      <Carousel
        data={getStartedItems}
        autoPlayInterval={5000}
        renderItem={({ item }) => (
          <YStack
            width={316}
            mx="$1"
            borderRadius="$3"
            overflow="hidden"
            position="relative"
            bg="$bgStrong"
            onPress={() => handleOpen(item)}
            pressStyle={{ scale: 0.98 }}
          >
            <Stack height={180}>
              <Image
                source={{ uri: item.image }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
              <LinearGradient
                position="absolute"
                left={0}
                right={0}
                top={0}
                bottom={0}
                colors={['rgba(6, 10, 14, 0.15)', 'rgba(6, 10, 14, 0.65)']}
              />
              <Stack
                position="absolute"
                left={0}
                right={0}
                top={0}
                bottom={0}
                alignItems="center"
                justifyContent="center"
              >
                <Icon name="PlayCircleSolid" size="$14" color="$whiteA12" />
              </Stack>
            </Stack>
            <XStack px="$3" py="$3" bg="$bgStrong" ai="center" jc="center">
              <SizableText
                size="$headingSm"
                color="$text"
                textAlign="center"
                numberOfLines={1}
                minHeight="$4"
              >
                {item.title}
              </SizableText>
            </XStack>
          </YStack>
        )}
        pageWidth="100%"
        maxPageWidth={320}
        showPaginationButton
        paginationContainerStyle={{
          paddingVertical: 12,
          gap: 8,
          justifyContent: 'center',
        }}
        activeDotStyle={{
          width: 20,
          height: 8,
          borderRadius: 999,
          bg: '$text',
        }}
        dotStyle={{
          width: 8,
          height: 8,
          borderRadius: 999,
          bg: '$borderSubdued',
          opacity: 0.45,
        }}
      />
    </YStack>
  );
}

function DeviceFaqsView() {
  const { result: faqsItems } = usePromiseResult(
    async () => {
      const response =
        await backgroundApiProxy.serviceSetting.fetchGetStartedLinks({
          slots: ['hardware_faqs'],
        });
      return response;
    },
    [],
    {
      initResult: [],
      watchLoading: true,
    },
  );

  const handleOpen = (item: { mode: number; payload: string }) => {
    parseNotificationPayload(item.mode, item.payload, () => {});
  };

  return (
    <>
      {faqsItems?.length
        ? faqsItems
            .filter((item) => item.title?.trim())
            .map((item) => (
              <Stack
                py="$3"
                onPress={() => handleOpen(item)}
                key={item.linkId}
                hoverStyle={{ opacity: 0.8 }}
                cursor="default"
              >
                <SizableText size="$bodyMdMedium" color="$text">
                  {item.title}
                </SizableText>
              </Stack>
            ))
        : null}
    </>
  );
}

function DeviceGetStarted() {
  const intl = useIntl();

  return (
    <YStack gap="$4">
      <XStack gap="$3" alignItems="center">
        <Icon name="BookOpenOutline" size="$5" color="$icon" />
        <SizableText size="$headingMd" color="$text">
          {intl.formatMessage({ id: ETranslations.global_get_started })}
        </SizableText>
      </XStack>

      <DeviceBanner />

      <Stack>
        <XStack jc="space-between" ai="center" py="$2.5">
          <SizableText size="$headingMd" color="$text">
            {intl.formatMessage({ id: ETranslations.global_faqs })}
          </SizableText>
          <Button
            size="small"
            variant="tertiary"
            title={intl.formatMessage({ id: ETranslations.global_learn_more })}
            onPress={() =>
              openUrlInDiscovery({ url: HELP_CENTER_HARDWARE_FAQ_URL })
            }
          >
            {intl.formatMessage({ id: ETranslations.global_learn_more })}
          </Button>
        </XStack>
        <Divider />
        <DeviceFaqsView />
      </Stack>
    </YStack>
  );
}

export default DeviceGetStarted;
