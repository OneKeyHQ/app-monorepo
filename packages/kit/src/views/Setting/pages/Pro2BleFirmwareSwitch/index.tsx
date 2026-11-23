import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  Dialog,
  Page,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { loadPro2BleFirmwareBase64 } from './pro2BleFirmwareAssets';
import {
  type IPro2BleFirmwareVersion,
  PRO2_BLE_FIRMWARE_VERSIONS,
} from './pro2BleFirmwareCatalog';

type IPro2BleDevice = {
  connectId?: string;
  name?: string;
  localName?: string;
  deviceType?: string;
};

type ISearchDevicesResponse = {
  success?: boolean;
  payload?: IPro2BleDevice[] | { error?: string; message?: string };
};

function isPro2Device(device: IPro2BleDevice) {
  if (device.deviceType === 'pro2') {
    return Boolean(device.connectId);
  }
  const name = `${device.name || ''} ${device.localName || ''}`.toLowerCase();
  return (
    Boolean(device.connectId) &&
    (name.includes('pro 2') || name.includes('pro2'))
  );
}

function deviceTitle(device: IPro2BleDevice) {
  return device.name || device.localName || 'Pro 2';
}

export default function PagePro2BleFirmwareSwitch() {
  const [devices, setDevices] = useState<IPro2BleDevice[]>([]);
  const [selectedConnectId, setSelectedConnectId] = useState('');
  const [status, setStatus] = useState(
    'Scan for a Pro 2, then install a firmware.',
  );
  const [busyKey, setBusyKey] = useState<string | undefined>();

  const scanDevices = useCallback(async () => {
    setBusyKey('scan');
    setStatus('Scanning for Pro 2...');
    try {
      const response =
        (await backgroundApiProxy.serviceHardware.searchDevices()) as ISearchDevicesResponse;
      const payload = Array.isArray(response.payload) ? response.payload : [];
      const pro2Devices = payload.filter(isPro2Device);
      setDevices(pro2Devices);
      setSelectedConnectId((current) => {
        if (pro2Devices.some((device) => device.connectId === current)) {
          return current;
        }
        return pro2Devices[0]?.connectId || '';
      });
      setStatus(
        pro2Devices.length > 0
          ? `Found ${pro2Devices.length} Pro 2 device${
              pro2Devices.length > 1 ? 's' : ''
            }.`
          : 'No Pro 2 found. Turn on Bluetooth and wake the device.',
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Scan failed. Try again.',
      );
    } finally {
      setBusyKey(undefined);
    }
  }, []);

  useEffect(() => {
    void scanDevices();
  }, [scanDevices]);

  const installFirmware = useCallback(
    async (firmware: IPro2BleFirmwareVersion) => {
      if (!selectedConnectId) {
        setStatus('Select a Pro 2 before installing.');
        return;
      }
      setBusyKey(firmware.id);
      setStatus(`Loading ${firmware.title}...`);
      try {
        const firmwareBase64 = await loadPro2BleFirmwareBase64(
          firmware.id,
          firmware.title,
        );
        setStatus(
          `Installing ${firmware.title}. Confirm the update on the device.`,
        );
        await backgroundApiProxy.serviceHardware.installBundledPro2BleFirmware({
          connectId: selectedConnectId,
          firmwareBase64,
        });
        setStatus(`${firmware.title} installed. The device may restart.`);
      } catch (error) {
        setStatus(
          error instanceof Error
            ? error.message
            : `${firmware.title} installation failed.`,
        );
      } finally {
        setBusyKey(undefined);
      }
    },
    [selectedConnectId],
  );

  const confirmInstall = useCallback(
    (firmware: IPro2BleFirmwareVersion) => {
      if (busyKey || !selectedConnectId) {
        return;
      }
      Dialog.show({
        title: `Install ${firmware.title}?`,
        description:
          'This replaces the Pro 2 Bluetooth firmware. Confirm the update on the device and keep it nearby until the installation finishes.',
        onConfirmText: 'Install',
        onConfirm: () => {
          void installFirmware(firmware);
        },
      });
    },
    [busyKey, installFirmware, selectedConnectId],
  );

  return (
    <Page scrollEnabled>
      <Page.Header title="Pro 2 Bluetooth firmware" />
      <YStack px="$5" py="$3" gap="$4">
        <SizableText size="$bodyMd" color="$textSubdued">
          Find My certification build. Choose a bundled Bluetooth firmware and
          install it on the connected Pro 2.
        </SizableText>
        <XStack>
          <Button
            size="small"
            variant="secondary"
            disabled={Boolean(busyKey)}
            onPress={() => {
              void scanDevices();
            }}
            testID="pro2-ble-firmware-scan"
          >
            {busyKey === 'scan' ? <Spinner size="small" /> : 'Scan again'}
          </Button>
        </XStack>
        <YStack>
          {devices.map((device) => {
            const connectId = device.connectId || '';
            const selected = connectId === selectedConnectId;
            return (
              <ListItem
                key={connectId}
                title={deviceTitle(device)}
                subtitle={selected ? `${connectId} · Selected` : connectId}
                onPress={() => {
                  setSelectedConnectId(connectId);
                }}
                testID={`pro2-ble-firmware-device-${connectId}`}
              />
            );
          })}
        </YStack>
        <YStack gap="$3">
          {PRO2_BLE_FIRMWARE_VERSIONS.map((firmware) => (
            <YStack key={firmware.id} gap="$2">
              <SizableText size="$bodyLgMedium">{firmware.title}</SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {firmware.detail} · {firmware.byteLength} bytes
              </SizableText>
              <XStack>
                <Button
                  size="medium"
                  variant="primary"
                  disabled={Boolean(busyKey) || !selectedConnectId}
                  onPress={() => {
                    confirmInstall(firmware);
                  }}
                  testID={`pro2-ble-firmware-install-${firmware.id}`}
                >
                  {busyKey === firmware.id ? (
                    <Spinner size="small" />
                  ) : (
                    'Install'
                  )}
                </Button>
              </XStack>
            </YStack>
          ))}
        </YStack>
        <SizableText size="$bodyMd">{status}</SizableText>
      </YStack>
    </Page>
  );
}
