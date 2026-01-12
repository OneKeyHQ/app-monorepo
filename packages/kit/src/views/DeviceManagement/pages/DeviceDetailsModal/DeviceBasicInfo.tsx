import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import {
  useCurrentWalletIdAtom,
  useDeviceMetaStateAtom,
  useDeviceMetaStaticAtom,
  useWalletWithDeviceAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { WalletRenameButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRename';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { EFirmwareType } from '@onekeyfe/hd-shared';

function DeviceWalletAvatar({
  badge,
  firmwareTypeBadge,
}: {
  badge: number | string | undefined;
  firmwareTypeBadge: EFirmwareType | undefined;
}) {
  const [walletWithDevice] = useWalletWithDeviceAtom();
  const { wallet } = walletWithDevice ?? {};
  return (
    <WalletAvatar
      size={100}
      wallet={wallet}
      status="default"
      badge={badge}
      firmwareTypeBadge={firmwareTypeBadge}
      firmwareTypeProps={{ badgeSize: 24, top: 0, left: 10 }}
    />
  );
}

function DeviceWalletRenameButton() {
  const [walletWithDevice] = useWalletWithDeviceAtom();
  const { wallet } = walletWithDevice ?? {};
  if (!wallet) return null;
  return <WalletRenameButton wallet={wallet} editable />;
}

function DeviceBasicInfo() {
  const intl = useIntl();

  const [currentWalletId] = useCurrentWalletIdAtom();
  const [deviceMetaStatic] = useDeviceMetaStaticAtom();
  const [deviceMetaState] = useDeviceMetaStateAtom();

  const isQrWallet = accountUtils.isQrWallet({ walletId: currentWalletId });

  const verificationStatus = useMemo(
    () => ({
      success: {
        type: 'success' as const,
        icon: 'BadgeVerifiedSolid' as const,
        color: '$iconSuccess' as const,
        textId: ETranslations.global_verified,
      },
      critical: {
        type: 'critical' as const,
        icon: 'ErrorSolid' as const,
        color: '$iconCritical' as const,
        textId: ETranslations.global_unverified,
      },
    }),
    [],
  );

  const status = deviceMetaState.isVerified
    ? verificationStatus.success
    : verificationStatus.critical;

  const deviceVerifiedBadge = {
    verifiedBadgeType: status.type,
    verifiedBadgeIconName: status.icon,
    verifiedBadgeIconColor: status.color,
    verifiedBadgeText: intl.formatMessage({ id: status.textId }),
    verifiedBadgeTextColor: status.color,
  };

  return (
    <YStack gap="$4" flex={1} w="100%">
      <XStack pt={10} h={100} gap="$4" ai="center">
        <XStack w={80} ai="center" jc="center">
          <DeviceWalletAvatar
            badge={undefined}
            firmwareTypeBadge={deviceMetaStatic.firmwareType}
          />
        </XStack>
        <YStack h="100%" pb="$1.5" justifyContent="space-between">
          <XStack ml={-5} pr="$5">
            <DeviceWalletRenameButton />
          </XStack>
          {deviceMetaStatic.deviceName ? (
            <SizableText size="$bodyMd" color="$textSubdued" pl="$0.5">
              {deviceMetaStatic.deviceName}
            </SizableText>
          ) : null}
          {isQrWallet ? null : (
            <XStack mt="$4" gap="$2">
              <Badge badgeSize="sm" badgeType="default">
                {deviceMetaStatic.firmwareVersionDisplay}
              </Badge>
              <Badge
                badgeSize="sm"
                badgeType={deviceVerifiedBadge.verifiedBadgeType}
              >
                <XStack ai="center" gap="$1.5">
                  <Icon
                    name={deviceVerifiedBadge.verifiedBadgeIconName}
                    color={deviceVerifiedBadge.verifiedBadgeIconColor}
                    size="$4"
                  />
                  <SizableText
                    size="$bodySmMedium"
                    color={deviceVerifiedBadge.verifiedBadgeTextColor}
                  >
                    {deviceVerifiedBadge.verifiedBadgeText}
                  </SizableText>
                </XStack>
              </Badge>
            </XStack>
          )}
        </YStack>
      </XStack>
    </YStack>
  );
}

export default DeviceBasicInfo;
