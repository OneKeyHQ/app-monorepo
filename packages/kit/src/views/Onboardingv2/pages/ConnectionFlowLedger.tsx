import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import natsort from 'natsort';
import { useIntl } from 'react-intl';

import {
  Button,
  EVideoResizeMode,
  HeightTransition,
  type IVideoSource,
  LottieView,
  SegmentControl,
  SizableText,
  Stack,
  Toast,
  Video,
  XStack,
  YStack,
} from '@onekeyhq/components';
import BluetoothSignalSpreading from '@onekeyhq/kit/assets/animations/bluetooth_signal_spreading.json';
import { usePromptWebDeviceAccess } from '@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess';
import { ThirdPartyDevicePermissionDenied } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import {
  ThirdPartyWalletAvatarImages,
  getThirdPartyDeviceAvatarImage,
} from '@onekeyhq/shared/src/utils/avatarUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import type { IConnectYourDeviceItem } from '@onekeyhq/shared/types/device';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { OnboardingTestIDs } from '../testIDs';
import { getThirdPartySearchTarget, sortDevicesData } from '../utils';

import { ConnectionIndicator } from './ConnectionIndicator';

import type { SearchDevice } from '@onekeyfe/hd-core';

enum EConnectionStatus {
  init = 'init',
  searching = 'searching',
  listing = 'listing',
}

function DeviceVideo({ themeVariant }: { themeVariant: 'light' | 'dark' }) {
  const videoSource = useMemo<IVideoSource>(
    () =>
      themeVariant === 'dark'
        ? (require('@onekeyhq/kit/assets/onboarding/Connect-Ledger-D.mp4') as IVideoSource)
        : (require('@onekeyhq/kit/assets/onboarding/Connect-Ledger-L.mp4') as IVideoSource),
    [themeVariant],
  );

  return (
    <Video
      muted
      autoPlay
      w="100%"
      h="100%"
      controls={false}
      playInBackground={false}
      resizeMode={EVideoResizeMode.COVER}
      source={videoSource}
    />
  );
}

function DevicePlaceholder({
  isBle,
  themeVariant,
}: {
  isBle: boolean;
  themeVariant: 'light' | 'dark';
}) {
  return (
    <Stack
      w="100%"
      h="100%"
      alignItems="center"
      justifyContent="center"
      bg="$bgSubdued"
    >
      {isBle ? (
        <LottieView
          source={BluetoothSignalSpreading}
          width={320}
          height={320}
          autoPlay
          loop
        />
      ) : (
        <DeviceVideo themeVariant={themeVariant} />
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main Ledger connection flow — same structure as USBOrBLEConnectionIndicator
// ---------------------------------------------------------------------------

export default function LedgerConnectionFlow() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isFocused = useIsFocused();
  const themeVariant = useThemeVariant();
  const { promptHidDeviceAccess } = usePromptWebDeviceAccess();

  const vendor = EHardwareVendor.ledger;
  const tabOptions = useMemo(
    () => [
      {
        label: platformEnv.isNative
          ? intl.formatMessage({ id: ETranslations.global_bluetooth })
          : 'USB',
        value: EConnectDeviceChannel.usbOrBle,
        testID: OnboardingTestIDs.connectionFlowLedgerUsbTab,
      },
      ...(platformEnv.isSupportDesktopBle
        ? [
            {
              label: intl.formatMessage({ id: ETranslations.global_bluetooth }),
              value: EConnectDeviceChannel.bluetooth,
              testID: OnboardingTestIDs.connectionFlowLedgerBleTab,
            },
          ]
        : []),
    ],
    [intl],
  );
  const [tabValue, setTabValue] = useState(EConnectDeviceChannel.usbOrBle);
  const deviceLabel = 'Ledger';
  const isBle =
    Boolean(platformEnv.isNative) ||
    tabValue === EConnectDeviceChannel.bluetooth;
  const transportType = isBle ? 'ble' : 'usb';

  // --- Device connection state (copied from useDeviceConnection) ---
  const [connectStatus, setConnectStatus] = useState(EConnectionStatus.init);
  const [searchedDevices, setSearchedDevices] = useState<SearchDevice[]>([]);
  const [isCheckingDeviceLoading, setIsChecking] = useState(false);
  const searchStateRef = useRef<'start' | 'stop'>('stop');
  const isSearchingRef = useRef(false);
  const scanGenerationRef = useRef(0);
  const [scanRequest, setScanRequest] = useState(0);

  const deviceScanner = useMemo(
    () =>
      deviceUtils.getDeviceScanner({
        backgroundApi: backgroundApiProxy,
      }),
    [],
  );

  // --- Scan logic (copied from useDeviceConnection.scanDevice) ---
  const scanDevice = useCallback(async () => {
    if (isSearchingRef.current) {
      return;
    }

    // Scope discovery to this tab; never change another vendor's transport atom.
    const generation = scanGenerationRef.current;

    const MAX_TRY_COUNT = 60;
    let pollsCompleted = 0;

    isSearchingRef.current = true;
    deviceScanner.startDeviceScan(
      (response) => {
        if (generation !== scanGenerationRef.current) return;
        pollsCompleted += 1;
        if (!response.success) {
          const error = convertDeviceError(response.payload);
          if (!(error instanceof ThirdPartyDevicePermissionDenied)) {
            Toast.error({
              title:
                error.message ||
                intl.formatMessage({
                  id: ETranslations.hardware_third_party_device_scan_error,
                }),
            });
          }
          // Reset the searching flag so a subsequent scanDevice() call can re-enter.
          isSearchingRef.current = false;
          // Return to init so the Start Connection button reappears.
          setConnectStatus(EConnectionStatus.init);
          deviceScanner.stopScan();
          return;
        }

        const sortedDevices = response.payload
          .filter((device) => {
            const connectionType =
              getThirdPartySearchTarget(device)?.connectionType;
            return connectionType
              ? connectionType === transportType
              : !platformEnv.isSupportDesktopBle || !isBle;
          })
          .toSorted((a, b) =>
            natsort({ insensitive: true })(
              a.name || a.connectId || a.deviceId || a.uuid,
              b.name || b.connectId || b.deviceId || b.uuid,
            ),
          );

        setSearchedDevices(sortedDevices);

        // Stop here rather than wait for the scanner's own limit one poll later:
        // a retry in between resets its counter and leaves this loop running.
        // Found devices stay listed; Start Connection comes back for a rescan.
        if (pollsCompleted >= MAX_TRY_COUNT) {
          isSearchingRef.current = false;
          deviceScanner.stopScan();
          setConnectStatus(EConnectionStatus.init);
        }
      },
      (state) => {
        if (generation !== scanGenerationRef.current) return;
        searchStateRef.current = state;
      },
      1, // pollIntervalRate — no backoff, fixed interval
      1500, // pollInterval — 1.5s between polls
      MAX_TRY_COUNT, // maxTryCount — search for up to ~90s
      vendor,
      {
        resetSession: true,
        discoveryMethod: 'searchDeviceTargets',
        transportType,
        waitForAllTransports: true,
        onError: (error) => {
          if (generation !== scanGenerationRef.current) return;
          isSearchingRef.current = false;
          deviceScanner.stopScan();
          setSearchedDevices([]);
          setConnectStatus(EConnectionStatus.init);
          if (!(error instanceof ThirdPartyDevicePermissionDenied)) {
            Toast.error({ title: error.message });
          }
        },
      },
    );
  }, [deviceScanner, vendor, intl, transportType, isBle]);

  const stopScan = useCallback(() => {
    scanGenerationRef.current += 1;
    isSearchingRef.current = false;
    deviceScanner.stopScan();
  }, [deviceScanner]);

  const ensureStopScan = useCallback(async () => {
    stopScan();
    try {
      await deviceScanner.stopScanAndWait();
    } catch {
      deviceScanner.stopScan();
    }
  }, [deviceScanner, stopScan]);

  // --- Device list data ---
  const devicesData = useMemo<IConnectYourDeviceItem[]>(
    () =>
      searchedDevices.map((item: SearchDevice) => {
        const vendorFields = item as SearchDevice & {
          vendorModel?: string;
          vendorModelName?: string;
        };
        return {
          title: item.name,
          src: ThirdPartyWalletAvatarImages.ledger,
          device: item,
          searchTarget: getThirdPartySearchTarget(item),
          avatarImg: getThirdPartyDeviceAvatarImage({
            vendor: EHardwareVendor.ledger,
            vendorModel: vendorFields.vendorModel,
            vendorModelName: vendorFields.vendorModelName,
            fallback: 'ledger',
          }),
        };
      }),
    [searchedDevices],
  );

  const sortedDevicesData = useMemo(
    () => sortDevicesData(devicesData, []),
    [devicesData],
  );

  // --- Device select ---
  const handleDeviceSelect = useCallback(
    async (data: IConnectYourDeviceItem) => {
      if (!data.device) return;
      const stopping = ensureStopScan();
      const generation = scanGenerationRef.current;
      await stopping;
      if (generation !== scanGenerationRef.current) return;

      navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
        deviceData: {
          ...data,
          vendor: EHardwareVendor.ledger,
        },
        isFirmwareVerified: true,
        tabValue,
      });
    },
    [ensureStopScan, navigation, tabValue],
  );

  // --- Start connection ---
  // Extension: HID permission popup first, then listing
  // Desktop: directly start listing (no permission needed)
  const onStartConnection = useCallback(async () => {
    const generation = scanGenerationRef.current;
    if (!isBle && platformEnv.isExtension) {
      // Extension needs user gesture to call navigator.hid.requestDevice()
      setIsChecking(true);
      try {
        const hidDevice = await promptHidDeviceAccess();
        if (hidDevice) {
          setIsChecking(false);
          if (generation === scanGenerationRef.current) {
            setScanRequest((value) => value + 1);
          }
        } else {
          setIsChecking(false);
        }
      } catch (error) {
        console.error('[Ledger] HID permission error:', error);
        setIsChecking(false);
      }
    } else {
      // Desktop / Web: start searching directly
      setScanRequest((value) => value + 1);
    }
  }, [promptHidDeviceAccess, isBle]);

  const onTabChange = useCallback(
    (value: string | number) => {
      if (
        value === tabValue ||
        !tabOptions.some((option) => option.value === value)
      )
        return;
      stopScan();
      setSearchedDevices([]);
      setConnectStatus(EConnectionStatus.init);
      setTabValue(value as EConnectDeviceChannel);
      setScanRequest((request) => request + 1);
    },
    [tabValue, tabOptions, stopScan],
  );

  // Drain the old native scan before starting the selected tab. Rapid tab
  // changes and blur invalidate pending starts as well as late scan results.
  useEffect(() => {
    if (!isFocused || scanRequest === 0) return;
    let cancelled = false;
    void (async () => {
      await ensureStopScan();
      if (cancelled) return;
      setSearchedDevices([]);
      setConnectStatus(EConnectionStatus.listing);
      await scanDevice();
    })();
    return () => {
      cancelled = true;
      stopScan();
    };
  }, [isFocused, scanRequest, ensureStopScan, scanDevice, stopScan]);

  useEffect(() => {
    if (!isFocused) stopScan();
    return stopScan;
  }, [isFocused, stopScan]);

  // --- Render ---
  return (
    <>
      {tabOptions.length > 1 ? (
        <SegmentControl
          fullWidth
          value={tabValue}
          onChange={onTabChange}
          options={tabOptions}
        />
      ) : null}
      <ConnectionIndicator>
        <ConnectionIndicator.Card>
          <ConnectionIndicator.Animation>
            <DevicePlaceholder isBle={isBle} themeVariant={themeVariant} />
          </ConnectionIndicator.Animation>
          <ConnectionIndicator.Content gap="$2">
            <ConnectionIndicator.Title>
              {isBle
                ? intl.formatMessage({
                    id: ETranslations.onboarding_bluetooth_prepare_to_connect,
                  })
                : intl.formatMessage(
                    {
                      id: ETranslations.connect_device_to_computer_via_usb,
                    },
                    { deviceLabel },
                  )}
            </ConnectionIndicator.Title>
            <YStack gap="$1">
              <SizableText color="$textSubdued">
                {`1. ${intl.formatMessage({
                  id: isBle
                    ? ETranslations.hardware_third_party_connect_step_ble
                    : ETranslations.hardware_third_party_connect_step_usb,
                })}`}
              </SizableText>
              <SizableText color="$textSubdued">
                {`2. ${intl.formatMessage({
                  id: ETranslations.hardware_third_party_connect_step_power_on_and_unlock,
                })}`}
              </SizableText>
            </YStack>
            {connectStatus === EConnectionStatus.init ? (
              <>
                <Button
                  testID={OnboardingTestIDs.connectionFlowLedgerStartBtn}
                  variant="primary"
                  mt="$2"
                  onPress={onStartConnection}
                  loading={isCheckingDeviceLoading}
                  disabled={isCheckingDeviceLoading}
                >
                  {intl.formatMessage({
                    id: ETranslations.global_start_connection,
                  })}
                </Button>
              </>
            ) : null}
          </ConnectionIndicator.Content>
        </ConnectionIndicator.Card>

        {connectStatus === EConnectionStatus.listing ||
        sortedDevicesData.length > 0 ? (
          <ConnectionIndicator.Footer>
            {connectStatus === EConnectionStatus.listing ? (
              <YStack px="$5">
                <XStack alignItems="center" justifyContent="space-between">
                  <SizableText color="$textDisabled">
                    {intl.formatMessage({
                      id: ETranslations.onboarding_bluetooth_connect_help_text,
                    })}
                    ...
                  </SizableText>
                </XStack>
              </YStack>
            ) : null}
            <HeightTransition initialHeight={0}>
              {sortedDevicesData.length > 0 ? (
                <>
                  {sortedDevicesData.map((data, index) => (
                    <ListItem
                      testID={OnboardingTestIDs.connectionFlowLedgerDeviceOption(
                        index,
                      )}
                      key={
                        data.searchTarget?.searchTargetId ||
                        data.device?.deviceId ||
                        data.device?.connectId ||
                        `ledger-usb-${index}`
                      }
                      drillIn
                      onPress={async () => {
                        await handleDeviceSelect(data);
                      }}
                      userSelect="none"
                    >
                      <WalletAvatar
                        wallet={undefined}
                        img={data.avatarImg ?? 'ledger'}
                      />
                      <ListItem.Text primary={data.device?.name} flex={1} />
                    </ListItem>
                  ))}
                </>
              ) : null}
            </HeightTransition>
          </ConnectionIndicator.Footer>
        ) : null}
      </ConnectionIndicator>
    </>
  );
}
