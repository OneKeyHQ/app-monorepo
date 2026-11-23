import { useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IHardwareDeviceType } from '@onekeyhq/components/src/content/HardwareDevice';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { getHardwareDeviceColor } from '@onekeyhq/shared/src/utils/hardwareDeviceColors';

import { DeviceArt } from '../DeviceArt';
import { FadeView } from '../FadeView';

import {
  DeviceBasicInfoSkeleton,
  getDeviceArtHeight,
} from './DeviceDetailsFrame';
import { DeviceUpdateLink } from './DeviceUpdateLink';

function Dot() {
  return (
    <SizableText size="$bodyMd" color="$textDisabled" aria-hidden>
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
  // The status the page opened with just sits there; once it changes (a
  // verification finishing), the new one fades in.
  const verifiedOnMountRef = useRef(verified);
  const meta: { key: string; text: string }[] = [];
  if (secondaryId) meta.push({ key: 'id', text: secondaryId });
  if (version) meta.push({ key: 'version', text: version });
  if (verified === undefined && !meta.length) return null;
  return (
    <XStack ai="center" columnGap="$2" rowGap="$1" flexWrap="wrap">
      {verified === undefined ? null : (
        <FadeView
          key={verified ? 'verified' : 'unverified'}
          fadeInOnMount={verified !== verifiedOnMountRef.current}
        >
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
        </FadeView>
      )}
      {meta.map((part, i) => (
        <XStack key={part.key} ai="center" gap="$2">
          {i > 0 || verified !== undefined ? <Dot /> : null}
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
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
  const artHeight = getDeviceArtHeight(gtMd);

  // Skeleton only while the first refresh is still in flight. Once settled,
  // fall through to the real (possibly degraded) header so a missing
  // featuresInfo / build error never sticks on an exit-less skeleton.
  if (!isQrWallet && !deviceMetaState.isReady && !refreshSettled) {
    return <DeviceBasicInfoSkeleton />;
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
      <YStack flex={1} minWidth={0}>
        <YStack gap="$1.5">
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
        </YStack>
        {showStatus && showFirmwareUpdate ? <DeviceUpdateLink /> : null}
      </YStack>
    </XStack>
  );
}

export default DeviceBasicInfo;
