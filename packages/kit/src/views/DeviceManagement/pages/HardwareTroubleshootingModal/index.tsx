import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Badge,
  IconButton,
  Page,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  FIRMWARE_CONTACT_US_URL,
  HELP_CENTER_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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

  const renderHeader = useCallback(() => {
    return (
      <XStack flex={1} ai="center">
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
            <XStack mt="$1.5" gap="$2" ai="center">
              <Badge badgeSize="sm" badgeType="default">
                {`v${deviceInfo.firmwareVersion}`}
              </Badge>
              <SizableText size="$bodySmMedium" color="$textSubdued">
                •
              </SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
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

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_hardware_troubleshooting,
        })}
      />
      <Page.Body>
        <YStack px="$5" py="$3">
          {renderHeader()}
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_hardware_troubleshooting_contact,
        })}
        onCancelText={intl.formatMessage({
          id: ETranslations.settings_help_center,
        })}
        onConfirm={() => openUrlExternal(FIRMWARE_CONTACT_US_URL)}
        onCancel={(_pop) => openUrlExternal(HELP_CENTER_URL)}
      />
    </Page>
  );
}

export default HardwareTroubleshootingModal;
