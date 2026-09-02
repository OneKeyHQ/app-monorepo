import { useCallback, useMemo, useState } from 'react';

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

// TODO(OK-61522): replace with Lokalise keys once the copy is accepted. The
// zh/en placeholders keep this change off the translation critical path.
const FOUND_DEVICES_COPY = {
  en: {
    one: 'Device found',
    many: 'Multiple devices found. Select the one to connect.',
  },
  zh: {
    one: '已找到设备',
    many: '已找到多台设备，请选择要连接的设备',
  },
};

function FoundDevicesStatus({
  count,
  isScanning,
}: {
  count: number;
  isScanning: boolean;
}) {
  const intl = useIntl();

  if (count === 0) {
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

  const copy = intl.locale.toLowerCase().startsWith('zh')
    ? FOUND_DEVICES_COPY.zh
    : FOUND_DEVICES_COPY.en;
  return (
    <SizableText px="$5" color="$textSubdued">
      {count === 1 ? copy.one : copy.many}
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
  const [pickedKey, setPickedKey] = useState<string | undefined>();
  const [isConnecting, setIsConnecting] = useState(false);

  const selected = useMemo(
    () => resolveSelectedFoundDevice(devices, pickedKey),
    [devices, pickedKey],
  );
  const selectedKey = selected ? getFoundDeviceKey(selected) : undefined;

  const handleConnect = useCallback(async () => {
    if (!selected || isConnecting) {
      return;
    }
    setIsConnecting(true);
    try {
      await onConnect(selected);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, onConnect, selected]);

  return (
    <>
      <FoundDevicesStatus count={devices.length} isScanning={isScanning} />
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
                  onPress={() => setPickedKey(key)}
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
              size="large"
              mx="$5"
              mt="$1"
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
