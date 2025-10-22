import { useCallback, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  HeightTransition,
  LottieView,
  Page,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes/onboardingv2';

import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { renderOnboardingHeaderRight } from '../components/HeaderRight';
import { PageContainer } from '../components/PageContainer';
import { TroubleShootingButton } from '../components/TroubleShootingButton';

import type { RouteProp } from '@react-navigation/core';

function USBConnectionIndicator() {
  return (
    <>
      <TroubleShootingButton type="usb" />
      <ConnectionIndicator>
        <ConnectionIndicator.Card>
          <ConnectionIndicator.Animation>
            <SizableText>Placeholder</SizableText>
          </ConnectionIndicator.Animation>
          <ConnectionIndicator.Content gap="$2">
            <ConnectionIndicator.Title>
              Connect OneKey Pro to your computer via USB
            </ConnectionIndicator.Title>
            {platformEnv.isExtension ? (
              <>
                <SizableText color="$textSubdued">
                  Click the button below then select your device in the popup to
                  connect
                </SizableText>
                <Button variant="primary" onPress={() => {}} mt="$2">
                  Start connection
                </Button>
              </>
            ) : null}
          </ConnectionIndicator.Content>
        </ConnectionIndicator.Card>
      </ConnectionIndicator>
    </>
  );
}

function BluetoothConnectionIndicator() {
  const intl = useIntl();
  const [bluetoothStatus, _setBluetoothStatus] = useState<
    | 'enabled'
    | 'disabledInSystem'
    | 'disabledInApp'
    | 'checking'
    | 'noSystemPermission'
  >('enabled');
  const [devices, setDevices] = useState<
    Array<{ id: string; name: string; type: string }>
  >([]);

  // Simulate loading devices after a delay
  const handleToggleDevices = useCallback(() => {
    if (devices.length > 0) {
      setDevices([]);
    } else {
      setDevices([
        { id: '1', name: 'Pro 062B', type: EDeviceType.Pro },
        { id: '2', name: 'Classic 1A3F', type: EDeviceType.Classic },
      ]);
    }
  }, [devices.length]);

  if (bluetoothStatus === 'disabledInApp') {
    return (
      <Empty
        title={intl.formatMessage({ id: ETranslations.bluetooth_disabled })}
        description={intl.formatMessage({
          id: ETranslations.bluetooth_enable_in_app_settings,
        })}
        buttonProps={{
          variant: 'primary',
          children: intl.formatMessage({
            id: ETranslations.onboarding_enable_bluetooth,
          }),
        }}
      />
    );
  }

  if (bluetoothStatus === 'noSystemPermission') {
    return (
      <Empty
        title={intl.formatMessage({
          id: ETranslations.onboarding_bluetooth_permission_needed,
        })}
        description={intl.formatMessage({
          id: ETranslations.bluetooth_permission_prompt,
        })}
        buttonProps={{
          variant: 'primary',
          children: intl.formatMessage({
            id: ETranslations.global_go_to_settings,
          }),
        }}
      />
    );
  }

  if (bluetoothStatus === 'disabledInSystem') {
    return (
      <Empty
        title={intl.formatMessage({ id: ETranslations.bluetooth_disabled })}
        description={intl.formatMessage({
          id: ETranslations.bluetooth_enable_in_system_settings,
        })}
        buttonProps={{
          variant: 'primary',
          children: intl.formatMessage({
            id: ETranslations.onboarding_enable_bluetooth,
          }),
        }}
      />
    );
  }

  return (
    <>
      <TroubleShootingButton type="bluetooth" />
      <ConnectionIndicator>
        <ConnectionIndicator.Card>
          <ConnectionIndicator.Animation>
            <YStack
              w="100%"
              h="100%"
              alignItems="center"
              justifyContent="center"
            >
              <YStack
                position="absolute"
                w={420}
                h={420}
                left="50%"
                top="50%"
                transform={[{ translateX: '-50%' }, { translateY: '-50%' }]}
                p={60}
                flex={1}
                borderWidth={3}
                borderColor="$neutral1"
                borderRadius="$full"
              >
                <YStack
                  p={50}
                  flex={1}
                  borderWidth={2}
                  borderColor="$neutral2"
                  borderRadius="$full"
                >
                  <YStack
                    flex={1}
                    borderWidth={1}
                    borderColor="$neutral3"
                    borderRadius="$full"
                  />
                </YStack>
              </YStack>
              <LottieView
                source={require('@onekeyhq/kit/assets/animations/bluetooth_signal_spreading.json')}
                width={320}
                height={320}
              />
            </YStack>
          </ConnectionIndicator.Animation>
          <ConnectionIndicator.Content>
            <ConnectionIndicator.Title>
              Keep your device near the computer to pair
            </ConnectionIndicator.Title>
          </ConnectionIndicator.Content>
        </ConnectionIndicator.Card>
        <ConnectionIndicator.Footer>
          <YStack px="$5">
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText color="$textDisabled">
                Looking for your device...
              </SizableText>
              <Button
                size="small"
                variant="tertiary"
                onPress={handleToggleDevices}
              >
                {devices.length > 0 ? 'Delete data' : 'Mock data'}
              </Button>
            </XStack>
          </YStack>
          <HeightTransition initialHeight={0}>
            {devices.length > 0 ? (
              <>
                {devices.map((device) => (
                  <ListItem
                    key={device.id}
                    drillIn
                    onPress={() => {
                      console.log('clicked', device);
                    }}
                    userSelect="none"
                  >
                    <WalletAvatar wallet={undefined} img={device.type as any} />
                    <ListItem.Text primary={device.name} flex={1} />
                  </ListItem>
                ))}
              </>
            ) : null}
          </HeightTransition>
        </ConnectionIndicator.Footer>
      </ConnectionIndicator>
    </>
  );
}

function QRCodeConnectionIndicator() {
  return (
    <ConnectionIndicator>
      <ConnectionIndicator.Card>
        <ConnectionIndicator.Animation>
          <SizableText>Placeholder</SizableText>
        </ConnectionIndicator.Animation>
        <ConnectionIndicator.Content gap="$4">
          <SizableText>
            Swipe up and choose Connect App Wallet → QR Code → OneKey App.
          </SizableText>
          <SizableText>Tap below to scan the QR code.</SizableText>
          <Button variant="primary" onPress={() => {}}>
            Scan QR code
          </Button>
        </ConnectionIndicator.Content>
      </ConnectionIndicator.Card>
    </ConnectionIndicator>
  );
}

export default function ConnectYourDevice() {
  const params =
    useRoute<
      RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.ConnectYourDevice>
    >();
  const { deviceType } = params?.params || {};
  console.log('deviceType', deviceType);
  const [value, setValue] = useState('usb');
  return (
    <Page>
      <Page.Header
        title="Connect your device"
        headerRight={renderOnboardingHeaderRight}
      />
      <Page.Body>
        <PageContainer>
          <SegmentControl
            fullWidth
            value={value}
            onChange={(v) => setValue(v as string)}
            options={[
              { label: 'USB', value: 'usb' },
              { label: 'Bluetooth', value: 'bluetooth' },
              { label: 'QR Code', value: 'qr' },
            ]}
          />
          {value === 'usb' ? <USBConnectionIndicator /> : null}
          {value === 'bluetooth' ? <BluetoothConnectionIndicator /> : null}
          {value === 'qr' ? <QRCodeConnectionIndicator /> : null}
        </PageContainer>
      </Page.Body>
    </Page>
  );
}
