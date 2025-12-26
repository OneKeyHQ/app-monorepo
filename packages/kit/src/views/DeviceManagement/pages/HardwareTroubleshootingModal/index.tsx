import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Alert,
  Badge,
  Button,
  Divider,
  Icon,
  IconButton,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  HELP_CENTER_COMMON_FAQ_URL,
  HELP_CENTER_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import type {
  EModalDeviceManagementRoutes,
  IModalDeviceManagementParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { RouteProp } from '@react-navigation/core';

function HardwareTroubleshootingModal() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalDeviceManagementParamList,
        EModalDeviceManagementRoutes.HardwareTroubleshootingModal
      >
    >();

  const media = useMedia();

  const { walletWithDevice } = route.params;
  const { wallet, device } = walletWithDevice;
  const isQrWallet = accountUtils.isQrWallet({ walletId: wallet.id });

  const defaultInfo = useMemo(
    () => ({
      firmwareVersion: '-',
      walletAvatarBadge: undefined,
      serialNumber: '--',
    }),
    [],
  );

  const { result: deviceInfo } = usePromiseResult(
    async () => {
      if (!device?.featuresInfo) {
        return defaultInfo;
      }

      const versions = await deviceUtils.getDeviceVersion({
        device,
        features: device.featuresInfo,
      });

      return {
        firmwareVersion: versions?.firmwareVersion ?? '-',
        walletAvatarBadge: undefined,
        serialNumber:
          deviceUtils.getDeviceSerialNoFromFeatures(device.featuresInfo) ??
          '--',
      };
    },
    [device, defaultInfo],
    { initResult: defaultInfo },
  );

  const { copyText } = useClipboard();
  const onCopyPress = useCallback(() => {
    copyText(deviceInfo.serialNumber);
  }, [copyText, deviceInfo.serialNumber]);

  const hardwareTroubleshootingQuestions = useMemo<
    {
      title: string;
      icon: IKeyOfIcons;
      link: string;
    }[]
  >(
    () => [
      {
        title: intl.formatMessage({
          id: ETranslations.global_faqs_firmware_detection,
        }),
        icon: 'ErrorOutline',
        link: 'https://help.onekey.so/articles/11461120',
      },
      {
        title: intl.formatMessage({
          id: ETranslations.global_faqs_forgot_pin,
        }),
        icon: 'UnlockedOutline',
        link: 'https://help.onekey.so/articles/11461114',
      },
      {
        title: intl.formatMessage({
          id: ETranslations.global_faqs_reset_device,
        }),
        icon: 'RepeatOutline',
        link: 'https://help.onekey.so/articles/11461116',
      },
      {
        title: intl.formatMessage({
          id: ETranslations.global_faqs_bootloader_mode,
        }),
        icon: 'ConsoleOutline',
        link: 'https://help.onekey.so/articles/11461126',
      },
      {
        title: intl.formatMessage({
          id: ETranslations.global_faqs_bridge_download,
        }),
        icon: 'DownloadOutline',
        link: 'https://help.onekey.so/articles/11461117',
      },
      {
        title: intl.formatMessage({
          id: ETranslations.global_faqs_bluetooth_status,
        }),
        icon: 'BluetoothOutline',
        link: 'https://help.onekey.so/articles/11461132',
      },
    ],
    [intl],
  );

  const handleFaqItemPress = useCallback((link: string) => {
    openUrlExternal(link);
  }, []);

  const renderHeader = useCallback(() => {
    return (
      <XStack ai="center" px="$5">
        <XStack h="$16" w="$16" ai="center" jc="center">
          <WalletAvatar
            size={50}
            wallet={wallet}
            status="default"
            badge={deviceInfo.walletAvatarBadge}
          />
        </XStack>
        <YStack flex={1}>
          <XStack pr="$5" ai="center">
            <SizableText size="$headingMd" color="$text">
              {wallet.name}
            </SizableText>
          </XStack>
          {isQrWallet ? null : (
            <XStack mt="$1.5" gap="$2" ai="center" flexShrink={1}>
              <Badge badgeSize="sm" badgeType="default">
                {`v${deviceInfo.firmwareVersion}`}
              </Badge>
              <SizableText size="$bodySmMedium" color="$textSubdued">
                •
              </SizableText>
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={1}
                flexShrink={1}
              >
                {deviceInfo.serialNumber}
              </SizableText>
              <IconButton
                size="small"
                variant="tertiary"
                icon="Copy3Outline"
                onPress={onCopyPress}
              />
            </XStack>
          )}
        </YStack>
      </XStack>
    );
  }, [
    deviceInfo.firmwareVersion,
    deviceInfo.walletAvatarBadge,
    deviceInfo.serialNumber,
    isQrWallet,
    wallet,
    onCopyPress,
  ]);

  const renderContent = useCallback(() => {
    return (
      <YStack pt="$3" pb="$2">
        {renderHeader()}
        <Divider mt="$5" borderBottomWidth="$2" borderColor="$bgSubdued" />
        <YStack pt="$5" pb="$3" px="$5">
          <XStack pt="$2" pb="$4" jc="space-between" ai="center">
            <SizableText size="$headingMd" color="$text">
              {intl.formatMessage({
                id: ETranslations.global_faqs,
              })}
            </SizableText>
            <Button
              variant="tertiary"
              size="small"
              iconAfter="OpenOutline"
              onPress={() => openUrlExternal(HELP_CENTER_COMMON_FAQ_URL)}
            >
              {intl.formatMessage({
                id: ETranslations.global_more,
              })}
            </Button>
          </XStack>

          <XStack
            alignItems="stretch"
            flexWrap="wrap"
            ml={-10}
            mt={-10}
            mb="$3"
          >
            {hardwareTroubleshootingQuestions.map((_, i) => (
              <Stack
                key={i}
                pl={10}
                pt={10}
                flexBasis={media.gtMd ? '33.333%' : '50%'}
                height="auto"
              >
                <YStack
                  flex={1}
                  role="button"
                  px={media.gtMd ? '$5' : '$3'}
                  py="$4"
                  borderWidth={StyleSheet.hairlineWidth}
                  borderColor={
                    media.gtMd ? '$borderDisabled' : '$borderSubdued'
                  }
                  borderRadius="$3"
                  bg="$bgSubdued"
                  hoverStyle={{
                    bg: '$bgActive',
                  }}
                  transition="background-color 0.2s"
                  cursor="pointer"
                  ai="center"
                  jc="center"
                  gap="$2"
                  onPress={() =>
                    handleFaqItemPress(hardwareTroubleshootingQuestions[i].link)
                  }
                >
                  <Icon
                    name={hardwareTroubleshootingQuestions[i].icon}
                    size="$6"
                    color="$iconSubdued"
                  />
                  <SizableText
                    size="$headingSm"
                    color="$text"
                    textAlign="center"
                    flexShrink={1}
                  >
                    {hardwareTroubleshootingQuestions[i].title}
                  </SizableText>
                </YStack>
              </Stack>
            ))}
          </XStack>

          <Alert
            my="$5"
            type="info"
            icon="ShieldCheckDoneOutline"
            title={intl.formatMessage({
              id: ETranslations.global_hardware_troubleshooting_warranty_title,
            })}
            description={intl.formatMessage({
              id: ETranslations.global_hardware_troubleshooting_warranty_description,
            })}
          />
        </YStack>
      </YStack>
    );
  }, [
    renderHeader,
    intl,
    hardwareTroubleshootingQuestions,
    handleFaqItemPress,
    media.gtMd,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_hardware_troubleshooting,
        })}
      />
      <Page.Body>{renderContent()}</Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_hardware_troubleshooting_contact,
        })}
        onCancelText={intl.formatMessage({
          id: ETranslations.settings_help_center,
        })}
        onConfirm={() => {
          void showIntercom();
        }}
        onCancel={(_pop) => openUrlExternal(HELP_CENTER_URL)}
      />
    </Page>
  );
}

export default HardwareTroubleshootingModal;
