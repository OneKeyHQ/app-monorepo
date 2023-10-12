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
      description="对操作结果的反馈，无需用户操作即可自行消失"
      suggestions={[
        '使用 Toast 显示简约明确的信息反馈',
        '用户点击或触摸 Toast 内容时，浮层将会停留在页面上',
        'Toast 显示的文本应少于 20 字',
        '不建议使用 Toast 显示过长的报错信息',
      ]}
      boundaryConditions={[
        'Toast 永远拥有最高层级的浮层',
        'Toast 组件能显示的最长文本内容为三排，超出三排将会缩略',
        '界面中只会存在一个 Toast 示例，后触发的 Toast 信息会覆盖前一条 Toast 信息',
      ]}
      elements={[
        {
          title: '默认',
          element: (
            <YStack space="$5">
              <XStack h={100}>
                {!!show && (
                  <LottieView
                    ref={ref}
                    style={{ width: 100 }}
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
                  onValueChange={(value) => {
                    setLoop(value);

                    createNewLottieView();
                  }}
                />
              </XStack>
              <XStack space="$5" alignItems="center">
                <Text>autoPlay: </Text>
                <Switch
                  value={autoPlay}
                  onValueChange={(value) => {
                    setAutoPlay(value);

                    createNewLottieView();
                  }}
                />
              </XStack>
              <XStack space="$5">
                <Button
                  onPress={() => {
                    ref.current?.pause?.();
                  }}
                >
                  <Button.Text>pause</Button.Text>
                </Button>
                <Button
                  onPress={() => {
                    ref.current?.play?.();
                  }}
                >
                  <Button.Text>play</Button.Text>
                </Button>
                <Button
                  onPress={() => {
                    ref.current?.reset();
                  }}
                >
                  <Button.Text>reset</Button.Text>
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
