/* eslint-disable  @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { useRef, useState } from 'react';

import { XStack, YStack } from 'tamagui';

import { Button, LottieView, Switch, Text } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const LottieViewGallery = () => {
  const ref = useRef<any>(null);
  const [show, setShow] = useState(true);
  const [loop, setLoop] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);

  const createNewLottieView = () => {
    setShow(false);
    setTimeout(() => {
      setShow(true);
    }, 100);
  };
  return (
    <Layout
      description=""
      suggestions={[]}
      boundaryConditions={[]}
      elements={[
        {
          title: '默认',
          element: (
            <YStack space="$5">
              <XStack h={100}>
                {!!show && (
                  <LottieView
                    ref={ref}
                    width={100}
                    height={100}
                    autoPlay={autoPlay}
                    loop={loop}
                    source={require('../../../../assets/animations/lottie_send_success_feedback.json')}
                  />
                )}
              </XStack>
              <XStack space="$5" alignItems="center">
                <Text>loop: </Text>
                <Switch
                  value={loop}
                  onChange={(value) => {
                    setLoop(value);

                    createNewLottieView();
                  }}
                />
              </XStack>
              <XStack space="$5" alignItems="center">
                <Text>autoPlay: </Text>
                <Switch
                  value={autoPlay}
                  onChange={(value) => {
                    setAutoPlay(value);

                    createNewLottieView();
                  }}
                />
              </XStack>
              <XStack space="$5">
                <Button
                  onPress={() => {
                    ref.current?.play?.();
                  }}
                >
                  play
                </Button>
                <Button
                  onPress={() => {
                    ref.current?.pause?.();
                  }}
                >
                  pause
                </Button>
                <Button
                  onPress={() => {
                    ref.current?.reset();
                  }}
                >
                  reset
                </Button>
              </XStack>
            </YStack>
          ),
        },
      ]}
    />
  );
};

export default LottieViewGallery;
