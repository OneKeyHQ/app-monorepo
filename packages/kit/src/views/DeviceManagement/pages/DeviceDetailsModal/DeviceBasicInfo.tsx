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
import {
  HardwareDevice,
  getHardwareDeviceAspect,
} from '@onekeyhq/components/src/content/HardwareDevice';
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
  const aspect = getHardwareDeviceAspect(deviceType);
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

function Dot() {
  return (
    <SizableText size="$bodyMd" color="$textDisabled">
      ·
    </SizableText>
  );
}

// The genuine status leads and carries the weight; the Bluetooth name and
// firmware version follow, quieter.
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
  const meta: { key: string; text: string }[] = [];
  if (secondaryId) meta.push({ key: 'id', text: secondaryId });
  if (version) meta.push({ key: 'version', text: version });
  if (verified === undefined && !meta.length) return null;
  return (
    <XStack ai="center" columnGap="$2" rowGap="$1" flexWrap="wrap">
      {verified === undefined ? null : (
        <XStack ai="center" gap="$1">
          <Icon
            name={verified ? 'BadgeVerifiedSolid' : 'ErrorSolid'}
            size="$4"
            color={verified ? '$iconSuccess' : '$iconCritical'}
            flexShrink={0}
          />
          <SizableText
            size="$bodyMdMedium"
            color={verified ? '$textSuccess' : '$textCritical'}
          >
            {intl.formatMessage({
              id: verified
                ? ETranslations.global_verified
                : ETranslations.global_unverified,
            })}
          </SizableText>
        </XStack>
      )}
      {meta.map((part, i) => (
        <XStack key={part.key} ai="center" gap="$2">
          {i > 0 || verified !== undefined ? <Dot /> : null}
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={1}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {part.text}
          </SizableText>
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
          <Skeleton w={200} h={gtMd ? 36 : 32} radius={8} />
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
