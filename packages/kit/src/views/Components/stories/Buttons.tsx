import { XStack, YStack } from 'tamagui';

import { Button, Spinner } from '@onekeyhq/components';
// import { Placeholder } from '@onekeyhq/components/src/Icon/react/outline';

import { Layout } from './utils/Layout';

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
              buttonVariant="primary"
              onPress={() => {
                alert('clicked');
              }}
            >
              <Button.Text>Primary</Button.Text>
            </Button>
            <Button size="large" buttonVariant="secondary">
              <Button.Text>Secondary</Button.Text>
            </Button>
            <Button size="large" buttonVariant="tertiary">
              <Button.Text>Tertiary</Button.Text>
            </Button>
            <Button size="large" buttonVariant="destructive">
              <Button.Text>Destructive</Button.Text>
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Size',
        element: (
          <YStack space="$2">
            <XStack space="$2" alignItems="center">
              <Button size="large" buttonVariant="primary">
                <Button.Text>Large</Button.Text>
              </Button>
              <Button size="medium" buttonVariant="primary">
                <Button.Text>Medium</Button.Text>
              </Button>
              <Button size="small" buttonVariant="primary">
                <Button.Text>Small</Button.Text>
              </Button>
            </XStack>
            <XStack space="$2" alignItems="center">
              <Button size="large" buttonVariant="secondary">
                <Button.Text>Large</Button.Text>
              </Button>
              <Button size="medium" buttonVariant="secondary">
                <Button.Text>Medium</Button.Text>
              </Button>
              <Button size="small" buttonVariant="secondary">
                <Button.Text>Small</Button.Text>
              </Button>
            </XStack>
            <XStack space="$10" alignItems="center">
              <Button size="large" buttonVariant="tertiary">
                <Button.Text>Large</Button.Text>
              </Button>
              <Button size="medium" buttonVariant="tertiary">
                <Button.Text>Medium</Button.Text>
              </Button>
              <Button size="small" buttonVariant="tertiary">
                <Button.Text>Small</Button.Text>
              </Button>
            </XStack>
          </YStack>
        ),
      },
      {
        title: 'Icon on different sizes',
        element: (
          <XStack space="$2" alignItems="flex-end">
            <Button size="large" buttonVariant="secondary">
              <Button.Icon>{/* <Placeholder /> */}</Button.Icon>
              <Button.Text>Large</Button.Text>
            </Button>
            <Button size="medium" buttonVariant="secondary">
              <Button.Icon>{/* <Placeholder /> */}</Button.Icon>
              <Button.Text>Medium</Button.Text>
            </Button>
            <Button size="small" buttonVariant="secondary">
              <Button.Icon>{/* <Placeholder /> */}</Button.Icon>
              <Button.Text>Small</Button.Text>
            </Button>
          </XStack>
        ),
      },
      {
        title: 'Icon on different colors',
        element: (
          <XStack space="$2" alignItems="center">
            <Button size="medium" buttonVariant="primary">
              <Button.Icon>{/* <Placeholder /> */}</Button.Icon>
              <Button.Text>Primary</Button.Text>
            </Button>
            <Button size="medium" buttonVariant="secondary">
              <Button.Icon>{/* <Placeholder /> */}</Button.Icon>
              <Button.Text>Secondary</Button.Text>
            </Button>
            <Button size="medium" buttonVariant="tertiary">
              <Button.Icon>{/* <Placeholder /> */}</Button.Icon>
              <Button.Text>Tertiary</Button.Text>
            </Button>
            <Button size="medium" buttonVariant="destructive">
              <Button.Icon>{/* <Placeholder /> */}</Button.Icon>
              <Button.Text>Destructive</Button.Text>
            </Button>
          </XStack>
        ),
      },
      {
        title: 'Disabled and loading',
        element: (
          <XStack space="$2" alignItems="center">
            <Button size="medium" buttonVariant="secondary" disabled>
              <Button.Text>Disabled</Button.Text>
            </Button>
            <Button size="medium" buttonVariant="secondary" disabled>
              <Button.Icon>
                <Spinner />
              </Button.Icon>
            </Button>
          </XStack>
        ),
      },
    ]}
  />
);

export default ButtonsGallery;
