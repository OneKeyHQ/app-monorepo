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
import { inspectPro2BleFirmwareBase64 } from '@onekeyhq/kit-bg/src/services/ServiceHardware/pro2BundledBleFirmware';

import {
  loadPro2BleFirmwareBase64,
  pickPro2BleFirmwareFile,
} from './pro2BleFirmwareAssets';
import {
  PRO2_BLE_FIRMWARE_VARIANTS,
  PRO2_BLE_FIRMWARE_VERSIONS,
} from './pro2BleFirmwareCatalog';

type IFirmwareInstallTarget = {
  key: string;
  title: string;
  description: string;
  loadFirmwareBase64: () => Promise<string>;
};

const MANUAL_FIRMWARE_KEY = 'manual';

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
    async (target: IFirmwareInstallTarget) => {
      if (!selectedConnectId) {
        setStatus('Select a Pro 2 before installing.');
        return;
      }
      setBusyKey(target.key);
      setStatus(`Loading ${target.title}...`);
      try {
        const firmwareBase64 = await target.loadFirmwareBase64();
        setStatus(
          `Installing ${target.title}. Confirm the update on the device.`,
        );
        await backgroundApiProxy.serviceHardware.installBundledPro2BleFirmware({
          connectId: selectedConnectId,
          firmwareBase64,
        });
        setStatus(`${target.title} installed. The device may restart.`);
      } catch (error) {
        setStatus(
          error instanceof Error
            ? error.message
            : `${target.title} installation failed.`,
        );
      } finally {
        setBusyKey(undefined);
      }
    },
    [selectedConnectId],
  );

  const confirmInstall = useCallback(
    (target: IFirmwareInstallTarget) => {
      if (busyKey || !selectedConnectId) {
        return;
      }
      Dialog.show({
        title: `Install ${target.title}?`,
        description: `${target.description}\n\nThis replaces the Pro 2 Bluetooth firmware. Confirm the update on the device and keep it nearby until the installation finishes.`,
        onConfirmText: 'Install',
        onConfirm: () => {
          void installFirmware(target);
        },
      });
    },
    [busyKey, installFirmware, selectedConnectId],
  );

  const pickAndInstallFirmware = useCallback(async () => {
    if (busyKey || !selectedConnectId) {
      return;
    }
    setBusyKey(MANUAL_FIRMWARE_KEY);
    try {
      const picked = await pickPro2BleFirmwareFile();
      if (!picked) {
        setStatus('No file selected.');
        return;
      }
      // Validate before asking for confirmation so a wrong file never reaches
      // the install dialog.
      const info = inspectPro2BleFirmwareBase64(picked.firmwareBase64);
      setStatus(`Selected ${picked.name} (package ${info.version}).`);
      confirmInstall({
        key: MANUAL_FIRMWARE_KEY,
        title: picked.name,
        description: `Package version ${info.version} · ${info.byteLength} bytes`,
        loadFirmwareBase64: () => Promise.resolve(picked.firmwareBase64),
      });
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Cannot read the file.',
      );
    } finally {
      setBusyKey(undefined);
    }
  }, [busyKey, confirmInstall, selectedConnectId]);

  return (
    <Page scrollEnabled>
      <Page.Header title="Pro 2 Bluetooth firmware" />
      <YStack px="$5" py="$3" gap="$4">
        <SizableText size="$bodyMd" color="$textSubdued">
          Find My certification build. Install a bundled debug or production
          Bluetooth firmware, or choose a firmware file, on the selected Pro 2.
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
        {PRO2_BLE_FIRMWARE_VARIANTS.map((group) => (
          <YStack key={group.variant} gap="$3">
            <YStack gap="$1">
              <SizableText size="$headingMd">{group.title}</SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {group.detail}
              </SizableText>
            </YStack>
            {PRO2_BLE_FIRMWARE_VERSIONS.filter(
              (firmware) => firmware.variant === group.variant,
            ).map((firmware) => (
              <YStack key={firmware.id} gap="$2">
                <SizableText size="$bodyLgMedium">{firmware.title}</SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  {firmware.fileName} · {firmware.byteLength} bytes
                </SizableText>
                <XStack>
                  <Button
                    size="medium"
                    variant="primary"
                    disabled={Boolean(busyKey) || !selectedConnectId}
                    onPress={() => {
                      confirmInstall({
                        key: firmware.id,
                        title: firmware.title,
                        description: firmware.fileName,
                        loadFirmwareBase64: () =>
                          loadPro2BleFirmwareBase64(
                            firmware.id,
                            firmware.title,
                          ),
                      });
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
        ))}
        <YStack gap="$2">
          <SizableText size="$headingMd">Choose a file</SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            Pick a signed Pro 2 coprocessor package (.bin) from Files. Raw
            Bluetooth images are rejected.
          </SizableText>
          <XStack>
            <Button
              size="medium"
              variant="secondary"
              disabled={Boolean(busyKey) || !selectedConnectId}
              onPress={() => {
                void pickAndInstallFirmware();
              }}
              testID="pro2-ble-firmware-pick-file"
            >
              {busyKey === MANUAL_FIRMWARE_KEY ? (
                <Spinner size="small" />
              ) : (
                'Choose firmware file'
              )}
            </Button>
          </XStack>
        </YStack>
        <SizableText size="$bodyMd">{status}</SizableText>
      </YStack>
    </Page>
  );
}
