import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  HeightTransition,
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IConnectYourDeviceItem } from '@onekeyhq/shared/types/device';

import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import { OnboardingTestIDs } from '../testIDs';

import {
  getFoundDeviceKey,
  resolveSelectedFoundDevice,
} from './foundDevicesFooterUtils';

import type { IDeviceType } from '@onekeyfe/hd-core';

function FoundDevicesStatus({
  hasDevices,
  isScanning,
}: {
  hasDevices: boolean;
  isScanning: boolean;
}) {
  const intl = useIntl();

  if (!hasDevices) {
    return (
      <XStack px="$5" alignItems="center" gap="$2">
        {isScanning ? <Spinner size="small" /> : null}
        <SizableText color="$textDisabled">
          {intl.formatMessage({
            id: ETranslations.onboarding_bluetooth_connect_help_text,
          })}
          ...
        </SizableText>
      </XStack>
    );
  }

  return (
    <SizableText px="$5" color="$textSubdued">
      {intl.formatMessage({
        id: ETranslations.select_device_to_connect__desc,
      })}
    </SizableText>
  );
}

// Scan results under the connection card: a status line, selectable rows and
// one primary "Connect" button, so moving forward never depends on noticing
// that a list row is tappable.
export function FoundDevicesFooter({
  devices,
  isScanning,
  onConnect,
}: {
  devices: IConnectYourDeviceItem[];
  // Only an active scan earns the spinner; the idle "start connection" states
  // keep the plain status line.
  isScanning: boolean;
  onConnect: (item: IConnectYourDeviceItem) => Promise<void> | void;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const [pickedKey, setPickedKey] = useState<string | undefined>();
  const [isConnecting, setIsConnecting] = useState(false);
  // Closes the gap between a press and the isConnecting re-render so rapid
  // taps cannot start two connections.
  const connectingRef = useRef(false);

  // An explicit row press is remembered for the rest of the scan session: if
  // the picked device drops out, the list shows no selection and Connect
  // disables until the user picks again, and an empty scan round (BLE packet
  // loss) must not downgrade that choice. A new scan session starts over with
  // automatic following: a tab switch remounts the footer, and a restarted
  // scan flips isScanning back on. An automatic default is committed to
  // state so re-sorted rounds cannot move the check mark, but it follows the
  // first row again whenever the defaulted device itself drops out.
  const isExplicitPickRef = useRef(false);
  const wasScanningRef = useRef(isScanning);
  useEffect(() => {
    if (isScanning && !wasScanningRef.current) {
      isExplicitPickRef.current = false;
    }
    wasScanningRef.current = isScanning;
  }, [isScanning]);
  useEffect(() => {
    if (devices.length === 0 || isExplicitPickRef.current) {
      return;
    }
    const stillListed =
      !!pickedKey &&
      devices.some((item) => getFoundDeviceKey(item) === pickedKey);
    if (!stillListed) {
      setPickedKey(getFoundDeviceKey(devices[0]));
    }
  }, [devices, pickedKey]);

  const selected = useMemo(
    () => resolveSelectedFoundDevice(devices, pickedKey),
    [devices, pickedKey],
  );
  const selectedKey = selected ? getFoundDeviceKey(selected) : undefined;

  const handleConnect = useCallback(async () => {
    if (!selected || connectingRef.current) {
      return;
    }
    connectingRef.current = true;
    setIsConnecting(true);
    try {
      await onConnect(selected);
    } finally {
      connectingRef.current = false;
      setIsConnecting(false);
    }
  }, [onConnect, selected]);

  return (
    <>
      <FoundDevicesStatus
        hasDevices={devices.length > 0}
        isScanning={isScanning}
      />
      <HeightTransition initialHeight={0}>
        {devices.length > 0 ? (
          <YStack gap="$2">
            {devices.map((item) => {
              const key = getFoundDeviceKey(item);
              const isSelected = key === selectedKey;
              return (
                <ListItem
                  key={key}
                  userSelect="none"
                  disabled={isConnecting}
                  onPress={() => {
                    // Every press is an explicit choice, including one on
                    // the row that is already selected by default.
                    isExplicitPickRef.current = true;
                    setPickedKey(key);
                  }}
                >
                  <WalletAvatar
                    wallet={undefined}
                    img={item.device?.deviceType as IDeviceType}
                  />
                  <ListItem.Text primary={item.device?.name} flex={1} />
                  {isSelected ? (
                    <Icon name="CheckRadioSolid" color="$iconActive" />
                  ) : (
                    <Stack
                      w="$5"
                      h="$5"
                      mx="$0.5"
                      borderRadius="$full"
                      borderWidth={1.5}
                      borderColor="$borderStrong"
                    />
                  )}
                </ListItem>
              );
            })}
            <Button
              testID={OnboardingTestIDs.connectYourDeviceConnectBtn}
              variant="primary"
              size={gtMd ? 'medium' : 'large'}
              mx="$5"
              mt="$1"
              mb="$3"
              disabled={!selected}
              loading={isConnecting}
              onPress={handleConnect}
            >
              {intl.formatMessage({ id: ETranslations.global_connect })}
            </Button>
          </YStack>
        ) : null}
      </HeightTransition>
    </>
  );
}
