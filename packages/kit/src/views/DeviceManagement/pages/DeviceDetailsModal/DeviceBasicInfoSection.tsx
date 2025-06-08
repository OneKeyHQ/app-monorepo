import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IBadgeType, IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import { Badge, Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { WalletRenameButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRename';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

function DeviceBasicInfoSection({
  data,
  onPressHomescreen,
  onPressAuthRequest,
  onPressCheckForUpdates,
  onPressTroubleshooting,
  authRequestLoading,
}: {
  data: IHwQrWalletWithDevice;
  onPressHomescreen: () => void;
  onPressAuthRequest: () => void;
  onPressCheckForUpdates: () => void;
  onPressTroubleshooting: () => void;
  authRequestLoading: boolean;
}) {
  const { wallet, device } = data;
  const intl = useIntl();
  const isQrWallet = accountUtils.isQrWallet({ walletId: wallet.id });

  const defaultInfo = useMemo(
    () => ({
      firmwareVersion: '-',
      walletAvatarBadge: undefined,
      verifiedBadgeType: 'default' as IBadgeType,
      verifiedBadgeText: '-',
      verifiedBadgeTextColor: '$iconCritical' as IIconProps['color'],
      verifiedBadgeIconName: 'ErrorSolid' as IKeyOfIcons,
      verifiedBadgeIconColor: '$iconCritical' as IIconProps['color'],
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

      const isVerified = Boolean(device.verifiedAtVersion);
      const verificationStatus = {
        success: {
          type: 'success' as IBadgeType,
          icon: 'BadgeVerifiedSolid' as IKeyOfIcons,
          color: '$iconSuccess' as IIconProps['color'],
          textId: ETranslations.global_verified,
        },
        critical: {
          type: 'critical' as IBadgeType,
          icon: 'ErrorSolid' as IKeyOfIcons,
          color: '$iconCritical' as IIconProps['color'],
          textId: ETranslations.global_unverified,
        },
      };

      const status = isVerified
        ? verificationStatus.success
        : verificationStatus.critical;

      return {
        firmwareVersion: versions?.firmwareVersion ?? '-',
        walletAvatarBadge: undefined,
        verifiedBadgeType: status.type,
        verifiedBadgeIconName: status.icon,
        verifiedBadgeIconColor: status.color,
        verifiedBadgeText: intl.formatMessage({ id: status.textId }),
        verifiedBadgeTextColor: status.color,
      };
    },
    [device, intl, defaultInfo],
    { initResult: defaultInfo },
  );

  return (
    <YStack pt="$3" pb="$3" gap="$5" bg="$bgSubdued" borderRadius="$4">
      <XStack pt={9} flex={1} ai="center">
        <XStack h={50} w={80} ai="center" jc="center">
          <WalletAvatar
            size={50}
            wallet={wallet}
            status="default"
            badge={deviceInfo.walletAvatarBadge}
          />
        </XStack>
        <YStack flex={1}>
          <XStack ml={-5} pr="$5">
            <WalletRenameButton wallet={wallet} editable />
          </XStack>
          {isQrWallet ? null : (
            <XStack mt="$1.5" gap="$1.5">
              <Badge badgeSize="sm" badgeType="default">
                {`v${deviceInfo.firmwareVersion}`}
              </Badge>
              <Badge badgeSize="sm" badgeType={deviceInfo.verifiedBadgeType}>
                <XStack ai="center" gap="$1.5">
                  <Icon
                    name={deviceInfo.verifiedBadgeIconName}
                    color={deviceInfo.verifiedBadgeIconColor}
                    size="$4"
                  />
                  <SizableText
                    size="$bodySmMedium"
                    color={deviceInfo.verifiedBadgeTextColor}
                  >
                    {deviceInfo.verifiedBadgeText}
                  </SizableText>
                </XStack>
              </Badge>
            </XStack>
          )}
        </YStack>
      </XStack>
      {isQrWallet ? null : (
        <YStack>
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.global_homescreen,
            })}
            drillIn
            onPress={onPressHomescreen}
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.device_auth_request_title,
            })}
            drillIn
            onPress={onPressAuthRequest}
            isLoading={authRequestLoading}
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.global_check_for_updates,
            })}
            drillIn
            onPress={onPressCheckForUpdates}
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.global_hardware_troubleshooting,
            })}
            drillIn
            onPress={onPressTroubleshooting}
          />
        </YStack>
      )}
    </YStack>
  );
}

export default DeviceBasicInfoSection;
