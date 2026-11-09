import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import type { IDialogConfirmProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  HeightTransition,
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IConnectYourDeviceItem } from '@onekeyhq/shared/types/device';

import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import { OnboardingTestIDs } from '../testIDs';

import {
  getFoundDeviceKey,
  resolveSelectedFoundDevice,
} from './foundDevicesFooterUtils';

import type { IConnectionIndicatorVariant } from '../pages/ConnectionIndicator';
import type { IDeviceType } from '@onekeyfe/hd-core';

function FoundDevicesStatus({
  hasDevices,
  isScanning,
  isPreparing,
  isConnecting,
  variant,
  searchDescription,
}: {
  hasDevices: boolean;
  isScanning: boolean;
  isPreparing: boolean;
  isConnecting: boolean;
  variant: IConnectionIndicatorVariant;
  searchDescription?: string;
}) {
  const intl = useIntl();

  if (!hasDevices) {
    if (variant === 'dialog') {
      if (!isPreparing && !isScanning) return null;
      return (
        <YStack
          testID="hardware-cloud-sync-device-search"
          width="100%"
          alignSelf="stretch"
          minHeight={200}
          px="$5"
          py="$6"
          gap="$5"
          alignItems="center"
          justifyContent="center"
        >
          <Spinner
            testID="hardware-cloud-sync-device-search-spinner"
            size="large"
            alignSelf="center"
          />
          <YStack width="100%" gap="$2" alignItems="center">
            <SizableText size="$bodyLgMedium" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.onboarding_bluetooth_connect_help_text,
              })}
            </SizableText>
            {searchDescription ? (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                textAlign="center"
              >
                {searchDescription}
              </SizableText>
            ) : null}
          </YStack>
        </YStack>
      );
    }
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
        id: isConnecting
          ? ETranslations.connecting_your_device
          : ETranslations.select_device_to_connect__desc,
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
  isPreparing = false,
  variant = 'embedded',
  searchDescription,
}: {
  devices: IConnectYourDeviceItem[];
  // Only an active scan earns the spinner; the idle "start connection" states
  // keep the plain status line.
  isScanning: boolean;
  onConnect: (item: IConnectYourDeviceItem) => Promise<void> | void;
  isPreparing?: boolean;
  variant?: IConnectionIndicatorVariant;
  searchDescription?: string;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { height: windowHeight } = useWindowDimensions();
  const [pickedKey, setPickedKey] = useState<string | undefined>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState<{
    device: IConnectYourDeviceItem;
    devices: IConnectYourDeviceItem[];
  }>();
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

  const visibleDevices = connectionAttempt?.devices ?? devices;
  const selected = useMemo(
    () =>
      connectionAttempt?.device ??
      resolveSelectedFoundDevice(devices, pickedKey),
    [connectionAttempt, devices, pickedKey],
  );
  const selectedKey = selected ? getFoundDeviceKey(selected) : undefined;

  const handleConnect = useCallback(
    async (item: IConnectYourDeviceItem) => {
      if (connectingRef.current) {
        return;
      }
      connectingRef.current = true;
      if (variant === 'dialog') {
        // Keep late scan rounds from replacing the list with the search state
        // while the selected device is already being connected.
        setConnectionAttempt({ device: item, devices: [...devices] });
      }
      setIsConnecting(true);
      try {
        await onConnect(item);
      } catch (error) {
        if (variant !== 'dialog') throw error;
        // Both the row and footer can connect; consume failures here because
        // Dialog.Footer only resets loading and does not handle rejections.
        errorToastUtils.toastIfError(error);
        errorToastUtils.showToastOfError(error);
      } finally {
        connectingRef.current = false;
        if (variant === 'dialog') setConnectionAttempt(undefined);
        setIsConnecting(false);
      }
    },
    [devices, onConnect, variant],
  );

  const connectLabel = intl.formatMessage({
    id: isConnecting
      ? ETranslations.device_stage_connecting__title
      : ETranslations.global_connect,
  });
  // Scan rounds rebuild `selected` and `handleConnect`; the dialog footer reads
  // them at press time so it only re-renders when what it shows changes.
  const latestConnectRef = useRef({ selected, handleConnect });
  useEffect(() => {
    latestConnectRef.current = { selected, handleConnect };
  }, [selected, handleConnect]);
  const onConfirmFooter = useCallback<
    NonNullable<IDialogConfirmProps['onConfirm']>
  >(async (dialog) => {
    const { selected: current, handleConnect: connect } =
      latestConnectRef.current;
    // The picker owns the successful hand-off; failures keep it open for retry.
    if (current) await connect(current);
    dialog.preventClose();
  }, []);
  const hasSelection = !!selected;
  const footerConfirmButtonProps = useMemo(
    () => ({
      testID: OnboardingTestIDs.connectYourDeviceConnectBtn,
      disabled: !hasSelection,
      loading: isConnecting,
    }),
    [hasSelection, isConnecting],
  );

  const deviceList =
    visibleDevices.length > 0 ? (
      <YStack gap="$2">
        {visibleDevices.map((item) => {
          const key = getFoundDeviceKey(item);
          const isSelected = key === selectedKey;
          return (
            <ListItem
              key={key}
              testID={OnboardingTestIDs.connectYourDeviceItem(key)}
              userSelect="none"
              // Keep the native Pressable mounted while connecting.
              onPress={() => {
                if (connectingRef.current) return;
                isExplicitPickRef.current = true;
                setPickedKey(key);
                if (visibleDevices.length === 1) return handleConnect(item);
              }}
            >
              <WalletAvatar
                wallet={undefined}
                img={item.avatarImg ?? (item.device?.deviceType as IDeviceType)}
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
        {variant !== 'dialog' ? (
          <Button
            testID={OnboardingTestIDs.connectYourDeviceConnectBtn}
            variant="primary"
            size={gtMd ? 'medium' : 'large'}
            mx="$5"
            mt="$1"
            mb="$3"
            disabled={!selected}
            loading={isConnecting}
            onPress={() => (selected ? handleConnect(selected) : undefined)}
          >
            {connectLabel}
          </Button>
        ) : null}
      </YStack>
    ) : null;

  const content = (
    <>
      <FoundDevicesStatus
        hasDevices={visibleDevices.length > 0}
        isScanning={isScanning}
        isPreparing={isPreparing}
        isConnecting={variant === 'dialog' && isConnecting}
        variant={variant}
        searchDescription={searchDescription}
      />
      {variant === 'dialog' ? (
        <Dialog.ScrollView
          testID={OnboardingTestIDs.connectYourDeviceList}
          // Reserve room for the dialog header, channel tabs and Connect footer.
          maxHeight={windowHeight * 0.4}
          flexGrow={0}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          {deviceList}
        </Dialog.ScrollView>
      ) : (
        <HeightTransition initialHeight={0}>{deviceList}</HeightTransition>
      )}
    </>
  );
  return variant === 'dialog' ? (
    <>
      <YStack alignSelf="stretch" gap="$2">
        {content}
      </YStack>
      <Dialog.Footer
        showFooter={visibleDevices.length > 0}
        showCancelButton={false}
        onConfirmText={connectLabel}
        confirmButtonProps={footerConfirmButtonProps}
        onConfirm={onConfirmFooter}
      />
    </>
  ) : (
    content
  );
}
