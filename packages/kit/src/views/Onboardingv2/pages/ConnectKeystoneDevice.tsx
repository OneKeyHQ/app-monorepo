import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import natsort from 'natsort';
import { useIntl } from 'react-intl';

import {
  Button,
  HeightTransition,
  Icon,
  SegmentControl,
  SizableText,
  Stack,
  Toast,
  YStack,
} from '@onekeyhq/components';
import { usePromptWebDeviceAccess } from '@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess';
import { isWebUsbNoDeviceSelectedError } from '@onekeyhq/kit/src/hooks/usePromptWebDeviceAccessUtils';
import { ThirdPartyDevicePermissionDenied } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { getThirdPartyDeviceDisplayName } from '@onekeyhq/shared/src/utils/thirdPartyDeviceName';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import type {
  IConnectYourDeviceItem,
  IThirdPartyHardwareSearchTarget,
} from '@onekeyhq/shared/types/device';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingPage } from '../components/Layout';
import { OnboardingTestIDs } from '../testIDs';
import { getThirdPartySearchTarget, sortDevicesData } from '../utils';

import { ConnectionIndicator } from './ConnectionIndicator';

import type { SearchDevice } from '@onekeyfe/hd-core';

// Use the neutral external-wallet artwork until a licensed Keystone asset is
// available. Showing a copied Trezor image here is actively misleading.
const keystoneLogo = require('@onekeyhq/kit/assets/pick-others.png');

// Same cadence as ConnectionFlowLedger: fixed 1.5s poll, ~90s window.
const KEYSTONE_SCAN_POLL_INTERVAL_MS = 1500;
const KEYSTONE_SCAN_MAX_TRY_COUNT = 60;

function searchDeviceToSearchTarget(
  device: SearchDevice,
): IThirdPartyHardwareSearchTarget {
  const raw = (
    device as SearchDevice & {
      raw?: {
        connectId?: unknown;
        connectionType?: unknown;
        model?: unknown;
        modelName?: unknown;
        serialNumber?: unknown;
      };
    }
  ).raw;
  const searchTargetId =
    typeof raw?.connectId === 'string' ? raw.connectId : device.connectId || '';
  const connectionType = raw?.connectionType === 'qr' ? 'qr' : ('usb' as const);
  return {
    searchTargetId,
    vendor: EHardwareVendor.keystone,
    connectionType,
    kind: connectionType === 'qr' ? 'interactive' : 'physical',
    label: device.name,
    model: typeof raw?.model === 'string' ? raw.model : undefined,
    modelName: typeof raw?.modelName === 'string' ? raw.modelName : undefined,
    serialNumber:
      typeof raw?.serialNumber === 'string' ? raw.serialNumber : undefined,
  };
}

function searchTargetToSearchDevice(
  target: IThirdPartyHardwareSearchTarget,
): SearchDevice {
  return {
    connectId: target.searchTargetId,
    deviceId: null,
    name: getThirdPartyDeviceDisplayName({
      brand: 'Keystone',
      modelName: target.modelName,
      model: target.model,
      name: target.label,
    }),
    deviceType: 'unknown',
    uuid: '',
    commType: 'bridge',
    raw: {
      vendor: EHardwareVendor.keystone,
      connectId: target.searchTargetId,
      deviceId: '',
      model: target.model,
      modelName: target.modelName,
      connectionType: target.connectionType,
      serialNumber: target.serialNumber,
      capabilities: { persistentDeviceIdentity: false },
    },
  } as SearchDevice;
}

enum EConnectionStatus {
  init = 'init',
  listing = 'listing',
}

function DevicePlaceholder({ isUsb }: { isUsb: boolean }) {
  return (
    <Stack
      w="100%"
      h="100%"
      alignItems="center"
      justifyContent="center"
      bg="$bgSubdued"
    >
      <Icon
        name={isUsb ? 'UsbOutline' : 'QrCodeOutline'}
        size="$16"
        color="$iconSubdued"
      />
    </Stack>
  );
}

/**
 * Keystone onboarding, same three beats as ConnectionFlowLedger/Trezor:
 * scan → pick from the device list → FinalizeWalletSetup does the connect
 * (that page owns the "connecting / creating wallet" progress UI, so the
 * device-side unlock+confirm happens under it, not behind a spinning button
 * here).
 *
 * QR has no physical device to enumerate, so discovery returns one virtual
 * target. FinalizeWalletSetup connects that target and owns the SDK's QR
 * display/scan interaction under its normal connection progress UI.
 */
function ConnectKeystoneDevicePage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isFocused = useIsFocused();
  const { promptWebUsbDeviceAccess } = usePromptWebDeviceAccess();

  const [connectStatus, setConnectStatus] = useState(EConnectionStatus.init);
  const [searchedDevices, setSearchedDevices] = useState<SearchDevice[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const isSearchingRef = useRef(false);

  const canUseUsb =
    !platformEnv.isNative &&
    typeof globalThis.navigator !== 'undefined' &&
    'usb' in globalThis.navigator;

  const tabOptions = useMemo(
    () =>
      canUseUsb
        ? [
            {
              label: intl.formatMessage({
                id: ETranslations.troubleshooting_usb,
              }),
              value: EConnectDeviceChannel.usbOrBle,
            },
            {
              label: intl.formatMessage({
                id: ETranslations.global_qr_code,
              }),
              value: EConnectDeviceChannel.qr,
            },
          ]
        : [
            {
              label: intl.formatMessage({
                id: ETranslations.global_qr_code,
              }),
              value: EConnectDeviceChannel.qr,
            },
          ],
    [canUseUsb, intl],
  );
  const [tabValue, setTabValue] = useState(tabOptions[0].value);
  const isUsbTab = tabValue === EConnectDeviceChannel.usbOrBle;

  const deviceScanner = useMemo(
    () => deviceUtils.getDeviceScanner({ backgroundApi: backgroundApiProxy }),
    [],
  );

  const finishWithDevice = useCallback(
    (data: IConnectYourDeviceItem) => {
      navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
        deviceData: { ...data, vendor: EHardwareVendor.keystone },
        isFirmwareVerified: true,
      });
    },
    [navigation],
  );

  // --- USB: scan ---
  // Note: no setForceTransportType() call, unlike the Ledger flow. Keystone has
  // no BLE channel, and that setting is global — writing it here would perturb
  // other vendors' transport selection for nothing.
  const scanDevice = useCallback(() => {
    if (isSearchingRef.current) {
      return;
    }
    let pollsCompleted = 0;
    isSearchingRef.current = true;
    deviceScanner.startDeviceScan(
      (response) => {
        pollsCompleted += 1;
        if (!response.success) {
          const error = convertDeviceError(response.payload, {
            silentMode: true,
            vendor: EHardwareVendor.keystone,
          });
          // A permission denial already gets its own dialog from the
          // third-party UI container — toasting it too would double up.
          // Same suppression as the Ledger and Trezor flows.
          if (!(error instanceof ThirdPartyDevicePermissionDenied)) {
            Toast.error({
              title:
                error.message ||
                intl.formatMessage({
                  id: ETranslations.hardware_third_party_device_scan_error,
                }),
            });
          }
          isSearchingRef.current = false;
          deviceScanner.stopScan();
          setConnectStatus(EConnectionStatus.init);
          return;
        }
        const sorted = [...response.payload].toSorted((a, b) =>
          natsort({ insensitive: true })(
            a.name || a.connectId || a.deviceId || a.uuid,
            b.name || b.connectId || b.deviceId || b.uuid,
          ),
        );
        setSearchedDevices(sorted);

        if (sorted.length > 0) {
          isSearchingRef.current = false;
          deviceScanner.stopScan();
          setConnectStatus(EConnectionStatus.init);
          return;
        }

        // The scanner stops itself past maxTryCount but doesn't tell the
        // caller — clear the flag so a later scan can re-enter.
        if (pollsCompleted >= KEYSTONE_SCAN_MAX_TRY_COUNT) {
          isSearchingRef.current = false;
          setConnectStatus(EConnectionStatus.init);
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.hardware_third_party_device_not_found_title,
            }),
          });
        }
      },
      () => undefined,
      1, // pollIntervalRate — fixed interval, no backoff
      KEYSTONE_SCAN_POLL_INTERVAL_MS,
      KEYSTONE_SCAN_MAX_TRY_COUNT,
      EHardwareVendor.keystone,
      {
        resetSession: true,
        transportType: 'usb',
        discoveryMethod: 'searchDeviceTargets',
      },
    );
  }, [deviceScanner, intl]);

  const stopScan = useCallback(() => {
    isSearchingRef.current = false;
    deviceScanner.stopScan();
  }, [deviceScanner]);

  // Awaits the in-flight poll instead of just flagging it, so the connect that
  // follows a row tap never overlaps a still-running enumerate on the same USB
  // device. Same helper, same reason, as the Ledger and Trezor flows.
  const ensureStopScan = useCallback(async () => {
    isSearchingRef.current = false;
    try {
      await deviceScanner.stopScanAndWait();
    } catch {
      deviceScanner.stopScan();
    }
  }, [deviceScanner]);

  // --- QR: discover the virtual target; Finalize performs the round trip ---
  const startQrConnection = useCallback(async () => {
    setIsStarting(true);
    try {
      const found =
        await backgroundApiProxy.serviceThirdPartyHardware.searchDeviceTargets({
          vendor: EHardwareVendor.keystone,
          transportType: 'qr',
        });
      if (!found.success) {
        const convertedError = convertThirdPartyDeviceError(found.payload, {
          vendor: 'Keystone',
        });
        if (convertedError.autoToast !== false) {
          Toast.error({ title: convertedError.message });
        }
        return;
      }
      const searchTarget = found.payload[0];
      if (!searchTarget) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.hardware_third_party_device_not_found,
          }),
        });
        return;
      }
      const device = searchTargetToSearchDevice(searchTarget);
      finishWithDevice({
        title: device.name,
        src: keystoneLogo,
        device,
        searchTarget,
        avatarImg: 'keystone',
      });
    } catch (error) {
      Toast.error({
        title:
          error instanceof Error
            ? error.message
            : intl.formatMessage({
                id: ETranslations.hardware_third_party_device_scan_error,
              }),
      });
    } finally {
      setIsStarting(false);
    }
  }, [finishWithDevice, intl]);

  // --- Start ---
  const onStartConnection = useCallback(async () => {
    if (!isUsbTab) {
      await startQrConnection();
      return;
    }
    // Browser WebUSB enumeration only returns already-granted devices, so its
    // picker must run in this user gesture. On desktop (Electron),
    // requestDevice() always cancels because the main process grants USB via
    // setDevicePermissionHandler instead of a select-usb-device handler.
    if (platformEnv.isWeb || platformEnv.isExtension) {
      setIsStarting(true);
      try {
        const granted = await promptWebUsbDeviceAccess(
          EHardwareVendor.keystone,
        );
        if (!granted) {
          return;
        }
      } catch (error) {
        if (!isWebUsbNoDeviceSelectedError(error)) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.hardware_third_party_device_scan_error,
            }),
          });
        }
        return;
      } finally {
        setIsStarting(false);
      }
    }
    setConnectStatus(EConnectionStatus.listing);
    scanDevice();
  }, [intl, isUsbTab, startQrConnection, promptWebUsbDeviceAccess, scanDevice]);

  // --- Device list ---
  const devicesData = useMemo<IConnectYourDeviceItem[]>(
    () =>
      searchedDevices.map((item) => ({
        title: item.name,
        src: keystoneLogo,
        device: item,
        searchTarget:
          getThirdPartySearchTarget(item) ?? searchDeviceToSearchTarget(item),
        avatarImg: 'keystone' as const,
      })),
    [searchedDevices],
  );
  const sortedDevicesData = useMemo(
    () => sortDevicesData(devicesData, []),
    [devicesData],
  );

  const handleDeviceSelect = useCallback(
    async (data: IConnectYourDeviceItem) => {
      if (!data.device) return;
      await ensureStopScan();
      // Returning from Finalize after a connection-invalidating error should
      // enumerate USB again instead of presenting the stale row that was
      // selected for the failed attempt.
      setConnectStatus(EConnectionStatus.listing);
      finishWithDevice(data);
    },
    [ensureStopScan, finishWithDevice],
  );

  // Switching channel abandons whatever the other one had on screen.
  useEffect(() => {
    stopScan();
    setSearchedDevices([]);
    setConnectStatus(EConnectionStatus.init);
  }, [tabValue, stopScan]);

  useEffect(() => {
    if (isFocused) {
      if (connectStatus === EConnectionStatus.listing) {
        scanDevice();
      }
    } else {
      stopScan();
    }
  }, [isFocused, connectStatus, scanDevice, stopScan]);

  useEffect(() => () => stopScan(), [stopScan]);

  const isListing = connectStatus === EConnectionStatus.listing;

  return (
    <OnboardingPage
      headerTitle={intl.formatMessage({
        id: ETranslations.onboarding_connect_your_device,
      })}
      scrollable
      alignTop
      narrow
      contentContainerProps={{ gap: '$5' }}
    >
      {tabOptions.length > 1 ? (
        <SegmentControl
          fullWidth
          value={tabValue}
          onChange={(v) => setTabValue(v as EConnectDeviceChannel)}
          options={tabOptions}
        />
      ) : null}
      <ConnectionIndicator>
        <ConnectionIndicator.Card>
          <ConnectionIndicator.Animation>
            <DevicePlaceholder isUsb={isUsbTab} />
          </ConnectionIndicator.Animation>
          <ConnectionIndicator.Content gap="$2">
            <ConnectionIndicator.Title>
              {isUsbTab
                ? intl.formatMessage(
                    { id: ETranslations.connect_device_to_computer_via_usb },
                    { deviceLabel: 'Keystone' },
                  )
                : intl.formatMessage({
                    id: ETranslations.connect_with_qr_code,
                  })}
            </ConnectionIndicator.Title>
            <YStack gap="$1">
              {isUsbTab ? (
                <>
                  <SizableText color="$textSubdued">
                    {`1. ${intl.formatMessage({
                      id: ETranslations.hardware_third_party_connect_step_usb,
                    })}`}
                  </SizableText>
                  <SizableText color="$textSubdued">
                    {`2. ${intl.formatMessage({
                      id: ETranslations.hardware_third_party_connect_step_power_on_and_unlock,
                    })}`}
                  </SizableText>
                </>
              ) : (
                <>
                  <SizableText color="$textSubdued">
                    {`1. ${intl.formatMessage({
                      id: ETranslations.scan_show_qr_code_steps,
                    })}`}
                  </SizableText>
                  <SizableText color="$textSubdued">
                    {`2. ${intl.formatMessage({
                      id: ETranslations.onboarding_create_qr_wallet_scan_qr_code_desc,
                    })}`}
                  </SizableText>
                </>
              )}
            </YStack>
            {isListing ? null : (
              <Button
                testID={
                  isUsbTab
                    ? OnboardingTestIDs.connectionFlowKeystoneUsbBtn
                    : OnboardingTestIDs.connectionFlowKeystoneQrBtn
                }
                variant="primary"
                mt="$2"
                loading={isStarting}
                disabled={isStarting}
                onPress={onStartConnection}
              >
                {isUsbTab
                  ? intl.formatMessage({
                      id: ETranslations.global_start_connection,
                    })
                  : intl.formatMessage({ id: ETranslations.scan_scan_qr_code })}
              </Button>
            )}
          </ConnectionIndicator.Content>
        </ConnectionIndicator.Card>

        {isListing || sortedDevicesData.length > 0 ? (
          <ConnectionIndicator.Footer>
            {isListing ? (
              <YStack px="$5">
                <SizableText color="$textDisabled">
                  {intl.formatMessage({
                    id: ETranslations.hardware_searching_for_device,
                  })}
                </SizableText>
              </YStack>
            ) : null}
            <HeightTransition initialHeight={0}>
              {sortedDevicesData.map((data, index) => (
                <ListItem
                  key={data.device?.connectId || data.device?.deviceId}
                  testID={OnboardingTestIDs.connectionFlowKeystoneDeviceOption(
                    index,
                  )}
                  drillIn
                  onPress={async () => {
                    await handleDeviceSelect(data);
                  }}
                  userSelect="none"
                >
                  <WalletAvatar
                    wallet={undefined}
                    img={data.avatarImg ?? 'keystone'}
                  />
                  <ListItem.Text primary={data.device?.name} flex={1} />
                </ListItem>
              ))}
            </HeightTransition>
          </ConnectionIndicator.Footer>
        ) : null}
      </ConnectionIndicator>
    </OnboardingPage>
  );
}

export default ConnectKeystoneDevicePage;
