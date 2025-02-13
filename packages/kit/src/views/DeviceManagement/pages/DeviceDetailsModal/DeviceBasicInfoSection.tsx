import { useIntl } from 'react-intl';

import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';
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
}: {
  data: IHwQrWalletWithDevice;
  onPressHomescreen: () => void;
  onPressAuthRequest: () => void;
  onPressCheckForUpdates: () => void;
}) {
  const { wallet, device } = data;
  const intl = useIntl();
  const isQrWallet = accountUtils.isQrWallet({ walletId: wallet.id });

  const { result: deviceInfo } = usePromiseResult(
    async () => {
      if (!device || !device.featuresInfo) {
        return {
          firmwareVersion: '-',
          walletAvatarBadge: isQrWallet ? 'QR' : undefined,
          verifiedBadgeIconName: 'DocumentSearch2Outline' as IKeyOfIcons,
          verifiedBadgeIconColor: '$iconSubdued' as IIconProps['color'],
        };
      }

      const versions = await deviceUtils.getDeviceVersion({
        device,
        features: device.featuresInfo,
      });

      let iconName: IKeyOfIcons = 'DocumentSearch2Outline';
      let iconColor: IIconProps['color'] = '$iconSubdued';

      if (device.verifiedAtVersion) {
        iconName = 'BadgeVerifiedSolid';
        iconColor = '$iconSuccess';
      } else if (device.verifiedAtVersion === '') {
        iconName = 'ErrorSolid';
        iconColor = '$iconCritical';
      }

      return {
        firmwareVersion: versions?.firmwareVersion ?? '-',
        walletAvatarBadge: isQrWallet ? 'QR' : undefined,
        verifiedBadgeIconName: iconName,
        verifiedBadgeIconColor: iconColor,
      };
    },
    [device, isQrWallet],
    {
      initResult: {
        firmwareVersion: '-',
        walletAvatarBadge: isQrWallet ? 'QR' : undefined,
        verifiedBadgeIconName: 'DocumentSearch2Outline',
        verifiedBadgeIconColor: '$iconSubdued',
      },
    },
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
          <XStack ml={-5} h="$6">
            <WalletRenameButton wallet={wallet} />
          </XStack>
          {isQrWallet ? null : (
            <XStack mt="$1.5" gap="$1.5">
              <Badge badgeSize="sm" badgeType="default">
                {`v${deviceInfo.firmwareVersion}`}
              </Badge>
              <Badge badgeSize="sm" badgeType="success">
                <XStack ai="center" gap="$1.5">
                  <Icon
                    name={deviceInfo.verifiedBadgeIconName}
                    color={deviceInfo.verifiedBadgeIconColor}
                    size="$4"
                  />
                  <SizableText size="$bodySmMedium" color="$iconSuccess">
                    {intl.formatMessage({
                      id: ETranslations.global_verified,
                    })}
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
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.global_check_for_updates,
            })}
            drillIn
            onPress={onPressCheckForUpdates}
          />
        </YStack>
      )}
    </YStack>
  );
}

export default DeviceBasicInfoSection;
