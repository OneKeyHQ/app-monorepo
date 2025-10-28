import { useCallback, useEffect, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IYStackProps } from '@onekeyhq/components';
import {
  Button,
  EVideoResizeMode,
  Empty,
  HeightTransition,
  Icon,
  Image,
  LottieView,
  Page,
  SegmentControl,
  SizableText,
  Video,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes/onboardingv2';

import { ConnectionTroubleShootingAccordion } from '../../../components/Hardware/ConnectionTroubleShootingAccordion';
import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { OnboardingLayout } from '../components/OnboardingLayout';

import type { RouteProp } from '@react-navigation/core';

function ConnectionIndicatorCard({ children }: { children: React.ReactNode }) {
  return (
    <YStack
      borderRadius={10}
      borderCurve="continuous"
      $platform-web={{
        boxShadow: '0 1px 1px 0 rgba(0, 0, 0, 0.20)',
      }}
      $platform-android={{ elevation: 0.5 }}
      $platform-ios={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0.5 },
        shadowOpacity: 0.2,
        shadowRadius: 0.5,
      }}
      bg="$bg"
    >
      {children}
    </YStack>
  );
}

function ConnectionIndicatorAnimation({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <YStack
      h={320}
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
    >
      {children}
    </YStack>
  );
}

function ConnectionIndicatorContent({
  children,
  ...rest
}: {
  children: React.ReactNode;
} & IYStackProps) {
  return (
    <YStack
      px="$5"
      py="$4"
      borderWidth={0}
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
      $platform-web={{
        borderStyle: 'dashed',
      }}
      {...rest}
    >
      {children}
    </YStack>
  );
}

function ConnectionIndicatorTitle({ children }: { children: React.ReactNode }) {
  return <SizableText size="$bodyMdMedium">{children}</SizableText>;
}

function connectionIndicatorFooter({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <YStack
      pt="$5"
      pb="$2"
      gap="$2"
      animation="quick"
      animateOnly={['opacity']}
      enterStyle={{
        opacity: 0,
      }}
    >
      {platformEnv.isWeb ? (
        <Image
          source={require('@onekeyhq/kit/assets/onboarding/radial-gradient.png')}
          position="absolute"
          left="50%"
          bottom="0"
          style={{
            transform: [{ translateX: '-50%' }, { translateY: '50%' }],
          }}
          width={520}
          height={226}
          zIndex={0}
        />
      ) : null}
      {children}
    </YStack>
  );
}

function TroubleShootingButton({ type }: { type: 'usb' | 'bluetooth' }) {
  const [showHelper, setShowHelper] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHelper(true);
    }, 10_000);

    return () => clearTimeout(timer);
  }, [showHelper]);

  return (
    <>
      {showHelper ? (
        <YStack
          bg="$bgSubdued"
          $platform-web={{
            boxShadow:
              '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
          }}
          $theme-dark={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: '$neutral3',
            bg: '$neutral3',
          }}
          $platform-native={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: '$neutral3',
          }}
          borderRadius="$2.5"
          borderCurve="continuous"
          overflow="hidden"
        >
          <HeightTransition initialHeight={0}>
            <XStack
              animation="quick"
              animateOnly={['opacity']}
              enterStyle={{ opacity: 0 }}
              m="0"
              px="$5"
              py="$2"
              hoverStyle={{
                bg: '$bgHover',
              }}
              focusable
              focusVisibleStyle={{
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
                outlineWidth: 2,
                outlineOffset: 2,
              }}
              userSelect="none"
              onPress={() => setShowTroubleshooting(!showTroubleshooting)}
            >
              <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
                Having trouble connecting your device?
              </SizableText>
              <Icon
                name={
                  showTroubleshooting ? 'MinusSmallOutline' : 'PlusSmallOutline'
                }
                size="$5"
                color="$iconSubdued"
              />
            </XStack>
          </HeightTransition>
          {showTroubleshooting ? (
            <ConnectionTroubleShootingAccordion connectionType={type} />
          ) : null}
        </YStack>
      ) : null}
    </>
  );
}

function ConnectionIndicatorRoot({ children }: { children: React.ReactNode }) {
  return (
    <YStack
      $platform-web={{
        boxShadow:
          '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
      }}
      $theme-dark={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
        bg: '$neutral4',
      }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral4',
      }}
      overflow="hidden"
      borderRadius={10}
      borderCurve="continuous"
      bg="$bgSubdued"
      animation="quick"
      animateOnly={['opacity', 'transform']}
      enterStyle={{
        opacity: 0,
        x: 24,
      }}
    >
      {children}
    </YStack>
  );
}

const ConnectionIndicator = Object.assign(ConnectionIndicatorRoot, {
  Animation: ConnectionIndicatorAnimation,
  Card: ConnectionIndicatorCard,
  Content: ConnectionIndicatorContent,
  Title: ConnectionIndicatorTitle,
  Footer: connectionIndicatorFooter,
});

function USBConnectionIndicator() {
  const themeVariant = useThemeVariant();

  return (
    <>
      <TroubleShootingButton type="usb" />
      <ConnectionIndicator>
        <ConnectionIndicator.Card>
          <ConnectionIndicator.Animation>
            <Video
              w="100%"
              h="100%" // required for native
              resizeMode={EVideoResizeMode.COVER}
              controls={false}
              playInBackground={false}
              source={
                themeVariant === 'dark'
                  ? require('@onekeyhq/kit/assets/onboarding/ProW-D.mp4')
                  : require('@onekeyhq/kit/assets/onboarding/ProW-L.mp4')
              }
            />
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
  const navigation = useAppNavigation();
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
                      navigation.push(EOnboardingPagesV2.CheckAndUpdate);
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
      <OnboardingLayout>
        <OnboardingLayout.Header title="Connect your device" />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent
            $platform-native={{
              py: 0,
            }}
          >
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
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
