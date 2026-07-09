import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import {
  useCurrentWalletIdAtom,
  useDeviceMetaStateAtom,
  useDeviceMetaStaticAtom,
  useRefreshSettledAtom,
  useWalletWithDeviceAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { WalletRenameButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRename';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { EFirmwareType } from '@onekeyfe/hd-shared';

function DeviceWalletAvatar({
  badge,
  firmwareTypeBadge,
  size,
}: {
  badge: number | string | undefined;
  firmwareTypeBadge: EFirmwareType | undefined;
  size: number;
}) {
  const [walletWithDevice] = useWalletWithDeviceAtom();
  const { wallet } = walletWithDevice ?? {};
  return (
    <WalletAvatar
      size={size}
      wallet={wallet}
      status="default"
      badge={badge}
      firmwareTypeBadge={firmwareTypeBadge}
      firmwareTypeProps={{ badgeSize: 24, top: 0, left: 10 }}
    />
  );
}

function DeviceWalletRenameButton({
  textSize,
}: {
  textSize: '$headingXl' | '$heading2xl';
}) {
  const [walletWithDevice] = useWalletWithDeviceAtom();
  const { wallet } = walletWithDevice ?? {};
  if (!wallet) return null;
  return <WalletRenameButton wallet={wallet} editable textSize={textSize} />;
}

function DeviceBasicInfoHeaderSkeleton({ avatarSize }: { avatarSize: number }) {
  return (
    <YStack gap="$4" flex={1} w="100%">
      <XStack pt={10} h={100} gap="$4" ai="center">
        <XStack w={80} ai="center" jc="center">
          <Skeleton w={avatarSize} h={avatarSize} radius="round" />
        </XStack>
        <YStack gap="$3" pb="$1.5">
          <Skeleton w={160} h="$7" radius={8} />
          <Skeleton w={100} h="$4" radius={4} />
          <XStack gap="$2">
            <Skeleton w={72} h="$5" radius={4} />
            <Skeleton w={80} h="$5" radius={4} />
          </XStack>
        </YStack>
      </XStack>
    </YStack>
  );
}

function DeviceBasicInfo({
  showFirmwareVersion = true,
  showDeviceVerification = true,
}: {
  showFirmwareVersion?: boolean;
  showDeviceVerification?: boolean;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();

  const [currentWalletId] = useCurrentWalletIdAtom();
  const [deviceMetaStatic] = useDeviceMetaStaticAtom();
  const [deviceMetaState] = useDeviceMetaStateAtom();
  const [refreshSettled] = useRefreshSettledAtom();

  const isQrWallet = accountUtils.isQrWallet({ walletId: currentWalletId });

  const avatarSize = gtMd ? 100 : 88;
  const titleTextSize: '$headingXl' | '$heading2xl' = gtMd
    ? '$heading2xl'
    : '$headingXl';

  const verificationStatus = useMemo(
    () => ({
      success: {
        type: 'success' as const,
        icon: 'BadgeVerifiedSolid' as const,
        color: '$iconSuccess' as const,
        textColor: '$textSuccessStrong' as const,
        textId: ETranslations.global_verified,
      },
      critical: {
        type: 'critical' as const,
        icon: 'ErrorSolid' as const,
        color: '$iconCritical' as const,
        textColor: '$textCriticalStrong' as const,
        textId: ETranslations.global_unverified,
      },
    }),
    [],
  );

  // Skeleton only while the first refresh is still in flight. Once settled,
  // fall through to the real (possibly degraded) header so a missing
  // featuresInfo / build error never sticks on an exit-less skeleton.
  if (!isQrWallet && !deviceMetaState.isReady && !refreshSettled) {
    return <DeviceBasicInfoHeaderSkeleton avatarSize={avatarSize} />;
  }

  const status = deviceMetaState.isVerified
    ? verificationStatus.success
    : verificationStatus.critical;

  const deviceVerifiedBadge = {
    verifiedBadgeType: status.type,
    verifiedBadgeIconName: status.icon,
    verifiedBadgeIconColor: status.color,
    verifiedBadgeText: intl.formatMessage({ id: status.textId }),
    verifiedBadgeTextColor: status.textColor,
  };

  return (
    <YStack gap="$4" flex={1} w="100%">
      <XStack pt={10} h={100} gap="$4" ai="center">
        <XStack w={80} ai="center" jc="center">
          <DeviceWalletAvatar
            badge={undefined}
            firmwareTypeBadge={deviceMetaStatic.firmwareType}
            size={avatarSize}
          />
        </XStack>
        <YStack h="100%" pb="$1.5" justifyContent="space-between">
          <XStack ml={-5} pr="$5">
            <DeviceWalletRenameButton textSize={titleTextSize} />
          </XStack>
          {deviceMetaStatic.deviceName ? (
            <SizableText size="$bodyMd" color="$textSubdued" pl="$0.5">
              {deviceMetaStatic.deviceName}
            </SizableText>
          ) : null}
          {isQrWallet || !showFirmwareVersion ? null : (
            <XStack mt="$4" gap="$2">
              <Badge badgeSize="sm" badgeType="default">
                {deviceMetaStatic.firmwareVersionDisplay}
              </Badge>
              {showDeviceVerification ? (
                <Badge
                  badgeSize="sm"
                  badgeType={deviceVerifiedBadge.verifiedBadgeType}
                  userSelect="none"
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
              ) : null}
            </XStack>
          )}
        </YStack>
      </XStack>
    </YStack>
  );
}

export default DeviceBasicInfo;
