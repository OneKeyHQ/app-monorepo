import { useEffect, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  type ILottieViewProps,
  type IYStackProps,
  LottieView,
  YStack,
} from '@onekeyhq/components';

import { DeviceInfoCard } from './DeviceInfoCard';

import type { IDeviceInfoCardProps } from './DeviceInfoCard';

function Container({ children, ...rest }: IYStackProps) {
  return (
    <YStack
      justifyContent="center"
      alignItems="center"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral3"
      borderRadius="$3"
      bg="$bgSubdued"
      borderCurve="continuous"
      overflow="hidden"
      {...rest}
    >
      {children}
    </YStack>
  );
}

function resolveLottieModule(module: unknown): ILottieViewProps['source'] {
  const lottieModule = module as { default?: ILottieViewProps['source'] };
  return lottieModule.default ?? module;
}

export default function CommunicatingLottieView({
  method,
  deviceType,
  walletName,
  bleName,
}: {
  method: 'usb' | 'bluetooth';
} & IDeviceInfoCardProps) {
  const [source, setSource] = useState<ILottieViewProps['source'] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    const loader =
      method === 'usb'
        ? import('@onekeyhq/kit/assets/animations/communicating-with-usb.json')
        : import('@onekeyhq/kit/assets/animations/bluetooth_signal_spreading.json');
    void loader.then((module) => {
      if (cancelled) {
        return;
      }
      setSource(resolveLottieModule(module));
    });
    return () => {
      cancelled = true;
    };
  }, [method]);

  const deviceInfoCard = (
    <DeviceInfoCard
      deviceType={deviceType}
      walletName={walletName}
      bleName={bleName}
      position="absolute"
      bottom="$2"
      left="$2"
    />
  );

  if (method === 'usb') {
    return (
      <Container>
        <YStack
          position="absolute"
          left="50%"
          top={0}
          transform={[{ translateX: '-50%' }, { translateY: '-50%' }]}
          w={400}
          h={400}
          borderWidth={2}
          borderColor="$neutral2"
          borderRadius="$full"
        />
        <YStack
          position="absolute"
          left="50%"
          top={0}
          transform={[{ translateX: '-50%' }, { translateY: '-50%' }]}
          w={266}
          h={266}
          bg="$bg"
          borderWidth={2}
          borderColor="$neutral3"
          borderRadius="$full"
        />
        {source ? (
          <LottieView w={360} h={176} source={source} autoPlay loop />
        ) : (
          <YStack w={360} h={176} />
        )}
        {deviceInfoCard}
      </Container>
    );
  }

  return (
    <Container h={178}>
      <YStack
        position="absolute"
        left="50%"
        top="50%"
        transform={[{ translateX: '-50%' }, { translateY: '-50%' }]}
        w={314}
        h={314}
        borderWidth={2}
        borderColor="$neutral2"
        borderRadius="$full"
      />
      <YStack
        position="absolute"
        left="50%"
        top="50%"
        transform={[{ translateX: '-50%' }, { translateY: '-50%' }]}
        w={228}
        h={228}
        bg="$bg"
        borderWidth={2}
        borderColor="$neutral3"
        borderRadius="$full"
      />
      {source ? (
        <LottieView w={220} h={220} source={source} autoPlay loop />
      ) : (
        <YStack w={220} h={220} />
      )}
      {deviceInfoCard}
    </Container>
  );
}
