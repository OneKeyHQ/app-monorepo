import { useState } from 'react';

import {
  Button,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  EThirdPartyHardwareUiAction,
  thirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { ThirdPartyWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { Layout } from './utils/Layout';

// Sets thirdPartyHardwareUiStateAtom directly so every Trezor/Ledger dialog and
// toast can be tested against a mocked device, no hardware needed.

type IDeviceMock = {
  label: string;
  vendor: EHardwareVendor;
  model: string;
};

const DEVICE_MOCKS: IDeviceMock[] = [
  {
    label: 'Trezor Model One',
    vendor: EHardwareVendor.trezor,
    model: 'Model One',
  },
  { label: 'Trezor Model T', vendor: EHardwareVendor.trezor, model: 'Model T' },
  { label: 'Trezor Safe 3', vendor: EHardwareVendor.trezor, model: 'Safe 3' },
  { label: 'Trezor Safe 5', vendor: EHardwareVendor.trezor, model: 'Safe 5' },
  { label: 'Trezor Safe 7', vendor: EHardwareVendor.trezor, model: 'Safe 7' },
  // Unknown model → must fall back to the generic Trezor avatar.
  { label: 'Trezor (unknown)', vendor: EHardwareVendor.trezor, model: 'T9X9' },
  { label: 'Ledger Nano X', vendor: EHardwareVendor.ledger, model: 'Nano X' },
  { label: 'Ledger Stax', vendor: EHardwareVendor.ledger, model: 'Stax' },
];

// Mirrors getThirdPartyDeviceAvatarImage: a known Trezor model uses its own
// avatar key, everything else falls back to the vendor avatar.
function resolveAvatarSource(device: IDeviceMock) {
  const avatars: Record<string, number> = ThirdPartyWalletAvatarImages;
  const profile = getVendorProfile(device.vendor);
  const key =
    device.vendor === EHardwareVendor.trezor && device.model in avatars
      ? device.model
      : profile.avatarKey;
  return avatars[key] ?? avatars.trezor;
}

type IActionItem = {
  label: string;
  action: EThirdPartyHardwareUiAction;
  payload?: Record<string, unknown>;
};

const DIALOGS: IActionItem[] = [
  {
    label: 'Trezor PIN matrix',
    action: EThirdPartyHardwareUiAction.requestTrezorPin,
  },
  {
    label: 'Trezor passphrase',
    action: EThirdPartyHardwareUiAction.requestTrezorPassphrase,
  },
  {
    label: 'Trezor THP pairing',
    action: EThirdPartyHardwareUiAction.requestTrezorThpPairing,
    payload: { availableMethods: [1], selectedMethod: 1 },
  },
  {
    label: 'Device not found',
    action: EThirdPartyHardwareUiAction.requestDeviceNotFound,
    payload: { message: 'Connect and unlock your device, then press Confirm.' },
  },
  {
    label: 'BTC high index',
    action: EThirdPartyHardwareUiAction.requestBtcHighIndexConfirm,
    payload: { path: "m/44'/0'/100'", accountIndex: 100 },
  },
];

const TOASTS: IActionItem[] = [
  {
    label: 'Confirm on device',
    action: EThirdPartyHardwareUiAction.confirmOnDevice,
  },
  { label: 'Searching', action: EThirdPartyHardwareUiAction.searching },
  { label: 'Connecting', action: EThirdPartyHardwareUiAction.connecting },
  { label: 'Processing', action: EThirdPartyHardwareUiAction.processing },
  {
    label: 'Unlock device',
    action: EThirdPartyHardwareUiAction.unlockDevice,
  },
];

function ActionRows({
  items,
  device,
}: {
  items: IActionItem[];
  device: IDeviceMock;
}) {
  return (
    <YStack gap="$2">
      {items.map((item) => (
        <XStack key={item.label} alignItems="center" gap="$3">
          <Button
            size="small"
            onPress={() =>
              void thirdPartyHardwareUiStateAtom.set({
                action: item.action,
                vendor: device.vendor,
                payload: item.payload,
              })
            }
          >
            {item.label}
          </Button>
          <SizableText size="$bodySm" color="$textSubdued" flex={1}>
            {`vendor=${device.vendor}${
              item.payload ? ` payload=${JSON.stringify(item.payload)}` : ''
            }`}
          </SizableText>
        </XStack>
      ))}
    </YStack>
  );
}

function ThirdPartyHardwareActionsTest() {
  const [device, setDevice] = useState<IDeviceMock>(DEVICE_MOCKS[0]);

  return (
    <YStack gap="$5">
      <Stack gap="$2">
        <SizableText size="$headingSm">Mock device</SizableText>
        <XStack flexWrap="wrap" gap="$2">
          {DEVICE_MOCKS.map((d) => (
            <Button
              key={d.label}
              size="small"
              variant={d.label === device.label ? 'primary' : 'secondary'}
              onPress={() => setDevice(d)}
            >
              {d.label}
            </Button>
          ))}
        </XStack>
        <XStack alignItems="center" gap="$3" pt="$2">
          <Image
            source={resolveAvatarSource(device)}
            w="$10"
            h="$10"
            borderRadius="$2"
          />
          <YStack>
            <SizableText size="$bodyMdMedium">{device.model}</SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {`vendor=${device.vendor}`}
            </SizableText>
          </YStack>
        </XStack>
      </Stack>

      <Stack gap="$2">
        <SizableText size="$headingSm">Dialogs</SizableText>
        <ActionRows items={DIALOGS} device={device} />
      </Stack>

      <Stack gap="$2">
        <SizableText size="$headingSm">Toasts</SizableText>
        <ActionRows items={TOASTS} device={device} />
      </Stack>

      <Button
        variant="destructive"
        size="small"
        onPress={() => void thirdPartyHardwareUiStateAtom.set(undefined)}
      >
        Clear
      </Button>
    </YStack>
  );
}

function ThirdPartyHardwareActionsGallery() {
  return (
    <Layout
      description="Trigger third-party (Trezor / Ledger) hardware UI dialogs and toasts against a mocked device model — no device needed."
      elements={[
        {
          title: 'Third-party HW UI actions',
          element: <ThirdPartyHardwareActionsTest />,
        },
      ]}
    />
  );
}

export default ThirdPartyHardwareActionsGallery;
