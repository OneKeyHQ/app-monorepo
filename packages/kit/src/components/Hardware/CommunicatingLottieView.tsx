import { StyleSheet } from 'react-native';

import type { IYStackProps } from '@onekeyhq/components';
import { LottieView, YStack } from '@onekeyhq/components';
import BluetoothSignalSpreading from '@onekeyhq/kit/assets/animations/bluetooth_signal_spreading.json';
import CommunicatingWithUSBLottie from '@onekeyhq/kit/assets/animations/communicating-with-usb.json';

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

export default function CommunicatingLottieView({
  method,
}: {
  method: 'usb' | 'bluetooth';
}) {
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
        <LottieView
          w={360}
          h={176}
          source={CommunicatingWithUSBLottie}
          autoPlay
          loop
        />
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
      <LottieView
        w={220}
        h={220}
        source={BluetoothSignalSpreading}
        autoPlay
        loop
      />
    </Container>
  );
}
