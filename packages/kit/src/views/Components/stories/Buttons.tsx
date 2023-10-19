import { useState } from 'react';

import { Button, XStack, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ActionButtonDemo = () => {
  const [spinning, setSpinning] = useState(false);
  return (
    <XStack space="$2" alignItems="center">
      <Button.Action
        text="click me!"
        size="medium"
        variant="secondary"
        iconName="BellSolid"
        spinning={spinning}
        onPress={() => {
          setSpinning(true);
          setTimeout(() => {
            setSpinning(false);
          }, 1500);
        }}
      />
      <Button.Action
        text="click me!(large size)"
        size="large"
        variant="secondary"
        spinning={spinning}
        onPress={() => {
          setSpinning(true);
          setTimeout(() => {
            setSpinning(false);
          }, 1500);
        }}
      />
    </XStack>
  );
};

const ButtonsGallery = () => (
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
        title: 'Variants',
        element: (
          <YStack space="$2">
            <Button
              size="large"
              variant="primary"
              onPress={() => {
                alert('clicked');
              }}
            >
              Primary
            </Button>
            <Button size="large" variant="secondary">
              Secondary
            </Button>
            <Button size="large" variant="tertiary">
              Tertiary
            </Button>
            <Button size="large" variant="destructive">
              Destructive
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Variants without Button.Text',
        element: (
          <YStack space="$2">
            <Button
              size="large"
              variant="primary"
              onPress={() => {
                alert('clicked');
              }}
            >
              Primary
            </Button>
            <Button size="large" variant="secondary">
              Secondary
            </Button>
            <Button size="large" variant="tertiary">
              Tertiary
            </Button>
            <Button size="large" variant="destructive">
              Destructive
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Size',
        element: (
          <YStack space="$2">
            <XStack space="$2" alignItems="center">
              <Button size="large" variant="primary">
                Large
              </Button>
              <Button size="medium" variant="primary">
                Medium
              </Button>
              <Button size="small" variant="primary">
                Small
              </Button>
            </XStack>
            <XStack space="$2" alignItems="center">
              <Button size="large" variant="secondary">
                Large
              </Button>
              <Button size="medium" variant="secondary">
                Medium
              </Button>
              <Button size="small" variant="secondary">
                Small
              </Button>
            </XStack>
            <XStack space="$10" alignItems="center">
              <Button size="large" variant="tertiary">
                Large
              </Button>
              <Button size="medium" variant="tertiary">
                Medium
              </Button>
              <Button size="small" variant="tertiary">
                Small
              </Button>
            </XStack>
          </YStack>
        ),
      },
      {
        title: 'Icon on different sizes',
        element: (
          <XStack space="$2" alignItems="flex-end">
            <Button size="large" variant="secondary">
              <Button.Icon name="PlaceholderOutline" />
              Large
            </Button>
            <Button size="medium" variant="secondary">
              <Button.Icon name="PlaceholderOutline" />
              Medium
            </Button>
            <Button size="small" variant="secondary">
              <Button.Icon name="PlaceholderOutline" />
              Small
            </Button>
          </XStack>
        ),
      },
      {
        title: 'Icon on different colors',
        element: (
          <XStack space="$2" alignItems="center">
            <Button size="medium" variant="primary">
              <Button.Icon name="PlaceholderOutline" />
              Primary
            </Button>
            <Button size="medium" variant="secondary">
              <Button.Icon name="PlaceholderOutline" />
              Secondary
            </Button>
            <Button size="medium" variant="tertiary">
              <Button.Icon name="PlaceholderOutline" />
              Tertiary
            </Button>
            <Button size="medium" variant="destructive">
              <Button.Icon name="PlaceholderOutline" />
              Destructive
            </Button>
          </XStack>
        ),
      },
      {
        title: 'Disabled and loading',
        element: (
          <XStack space="$2" alignItems="center">
            <Button size="medium" variant="secondary" disabled>
              Disabled
            </Button>
            <Button size="medium" variant="destructive" disabled>
              <Button.Spinner />
            </Button>
            <Button size="medium" variant="secondary" disabled>
              <Button.Spinner />
            </Button>
            <Button size="large" variant="secondary" disabled>
              <Button.Spinner />
            </Button>
          </XStack>
        ),
      },
      {
        title: 'Action Button',
        element: <ActionButtonDemo />,
      },
    ]}
  />
);

export default ButtonsGallery;
