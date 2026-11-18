import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { HardwareDevice } from '@onekeyhq/components/src/content/HardwareDevice';
import type { IHardwareDeviceType } from '@onekeyhq/components/src/content/HardwareDevice';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import {
  getDeviceSecondaryIdentifier,
  useCurrentWalletIdAtom,
  useDeviceMetaStateAtom,
  useDeviceMetaStaticAtom,
  useDeviceTypeAtom,
  useRefreshSettledAtom,
  useWalletWithDeviceAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { WalletRenameButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRename';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { getHardwareDeviceColor } from '@onekeyhq/shared/src/utils/hardwareDeviceColors';
import type { IHardwareDeviceColor } from '@onekeyhq/shared/src/utils/hardwareDeviceColors';

import { DeviceUpdateLink } from './DeviceUpdateLink';

// Height over width of each drawn model (their shells' artwork sizes), so
// every model is drawn at the same height.
const DEVICE_ASPECT: Partial<Record<IHardwareDeviceType, number>> = {
  classic: 539 / 327,
  classic1s: 539 / 327,
  classicpure: 539 / 327,
  mini: 1417 / 657,
  touch: 1751 / 1044,
  pro: 569 / 350,
  pro2: 1714 / 1084,
};

// The device as drawn for its model, lit on the home screen it idles on.
// Models without a drawing (Trezor, Ledger) keep the wallet avatar.
function DeviceArt({
  deviceType,
  color,
  wallet,
  height,
}: {
  deviceType: IHardwareDeviceType | undefined;
  color: IHardwareDeviceColor | undefined;
  wallet: IDBWallet | undefined;
  height: number;
}) {
  const aspect = deviceType ? DEVICE_ASPECT[deviceType] : undefined;
  if (!aspect) {
    return <WalletAvatar size={height} wallet={wallet} status="default" />;
  }
  const width = Math.round(height / aspect);
  return (
    <Stack w={width} h={height} flexShrink={0} pointerEvents="none" aria-hidden>
      <HardwareDevice
        deviceType={deviceType}
        color={color}
        width={width}
        // The scene that shows the idle home screen; arriving already lit
        // keeps a wake-up from reading as the device connecting.
        animation="connecting"
        instantEntry
        shadow
      />
    </Stack>
  );
}

// Bluetooth name · firmware version · genuine status, as one quiet line.
function StatusLine({
  secondaryId,
  version,
  verified,
}: {
  secondaryId: string | undefined;
  version: string | undefined;
  verified: boolean | undefined;
}) {
  const intl = useIntl();
  const parts: { key: string; node: ReactNode }[] = [];
  if (secondaryId) {
    parts.push({
      key: 'id',
      node: (
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
          {secondaryId}
        </SizableText>
      ),
    });
  }
  if (version) {
    parts.push({
      key: 'version',
      node: (
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {version}
        </SizableText>
      ),
    });
  }
  if (verified !== undefined) {
    parts.push({
      key: 'genuine',
      node: (
        <XStack ai="center" gap="$1">
          <Icon
            name={verified ? 'BadgeVerifiedSolid' : 'ErrorSolid'}
            size="$4"
            color={verified ? '$iconSuccess' : '$iconCritical'}
          />
          <SizableText
            size="$bodyMd"
            color={verified ? '$textSubdued' : '$textCritical'}
          >
            {intl.formatMessage({
              id: verified
                ? ETranslations.global_verified
                : ETranslations.global_unverified,
            })}
          </SizableText>
        </XStack>
      ),
    });
  }
  if (!parts.length) return null;
  return (
    <XStack flexWrap="wrap" ai="center" columnGap="$2" rowGap="$1">
      {parts.map((part, i) => (
        <XStack key={part.key} ai="center" gap="$2">
          {i > 0 ? (
            <SizableText size="$bodyMd" color="$textDisabled">
              ·
            </SizableText>
          ) : null}
          {part.node}
        </XStack>
      ))}
    </XStack>
  );
}

// Which device this is, and its firmware and genuine status in one line.
function DeviceBasicInfo({
  showFirmwareVersion = true,
  showDeviceVerification = true,
  showFirmwareUpdate = true,
}: {
  showFirmwareVersion?: boolean;
  showDeviceVerification?: boolean;
  showFirmwareUpdate?: boolean;
}) {
  const { gtMd } = useMedia();
  const [currentWalletId] = useCurrentWalletIdAtom();
  const [walletWithDevice] = useWalletWithDeviceAtom();
  const [deviceMetaStatic] = useDeviceMetaStaticAtom();
  const [deviceMetaState] = useDeviceMetaStateAtom();
  const [deviceType] = useDeviceTypeAtom();
  const [refreshSettled] = useRefreshSettledAtom();
  const wallet = walletWithDevice?.wallet;
  const isQrWallet = accountUtils.isQrWallet({ walletId: currentWalletId });
  const artHeight = gtMd ? 96 : 80;

  // Skeleton only while the first refresh is still in flight. Once settled,
  // fall through to the real (possibly degraded) header so a missing
  // featuresInfo / build error never sticks on an exit-less skeleton.
  if (!isQrWallet && !deviceMetaState.isReady && !refreshSettled) {
    return (
      <XStack ai="center" gap={gtMd ? '$5' : '$4'}>
        <Skeleton w={Math.round(artHeight * 0.62)} h={artHeight} radius={12} />
        <YStack gap="$2">
          <Skeleton w={200} h="$8" radius={8} />
          <Skeleton w={240} h="$5" radius={4} />
        </YStack>
      </XStack>
    );
  }

  const showStatus = !isQrWallet;
  return (
    <XStack ai="center" gap={gtMd ? '$5' : '$4'}>
      <DeviceArt
        deviceType={deviceType as IHardwareDeviceType | undefined}
        color={getHardwareDeviceColor({
          deviceType,
          serialNo: deviceMetaStatic.serialNo,
        })}
        wallet={wallet}
        height={artHeight}
      />
      <YStack flex={1} minWidth={0} gap="$1.5">
        {wallet ? (
          // The button carries its own inset; pull it back onto the text edge.
          <XStack ml={-6} maxWidth="100%" minWidth={0}>
            <WalletRenameButton
              wallet={wallet}
              editable
              textSize={gtMd ? '$heading3xl' : '$heading2xl'}
            />
          </XStack>
        ) : null}
        <StatusLine
          secondaryId={getDeviceSecondaryIdentifier(deviceMetaStatic)}
          version={
            showStatus && showFirmwareVersion
              ? deviceMetaStatic.firmwareVersionDisplay
              : undefined
          }
          verified={
            showStatus && showDeviceVerification
              ? deviceMetaState.isVerified
              : undefined
          }
        />
        {showStatus && showFirmwareUpdate ? <DeviceUpdateLink /> : null}
      </YStack>
    </XStack>
  );
}

export default DeviceBasicInfo;
