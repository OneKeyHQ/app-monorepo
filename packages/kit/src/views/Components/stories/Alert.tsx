import { Alert, Stack, YStack } from '@onekeyhq/components';

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
        title: 'State',
        element: (
          <YStack space="$4">
            <Alert
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
            />
            <Alert
              type="success"
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
            />
            <Alert
              type="critical"
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
            />
            <Alert
              type="info"
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
            />
            <Alert
              type="warning"
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
            />
          </YStack>
        ),
      },
      {
        title: 'Dismiss',
        element: (
          <YStack space="$4">
            <Alert
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
              closable
            />
          </YStack>
        ),
      },
      {
        title: 'Actions',
        element: (
          <YStack space="$4">
            <Alert
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
              action={{ primary: 'Action' }}
            />
            <Alert
              title="Title"
              description="Description here..."
              icon="PlaceholderOutline"
              action={{ primary: 'Action', secondary: 'Learn More' }}
            />
          </YStack>
        ),
      },
    ]}
  />
);

export default ButtonsGallery;
