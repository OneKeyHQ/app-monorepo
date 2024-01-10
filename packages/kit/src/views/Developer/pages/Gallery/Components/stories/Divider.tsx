import { Divider, SizableText, XStack, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const DividerGallery = () => (
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
        title: '默认状态',
        element: (
          <YStack space="$8">
            <YStack space="$4">
              <SizableText>Line 1</SizableText>
              <Divider width="100%" />
              <SizableText>Line 2</SizableText>
            </YStack>

            <XStack space="$4">
              <SizableText>Left</SizableText>
              <Divider vertical />
              <SizableText>Right</SizableText>
            </XStack>
          </YStack>
        ),
      },
    ]}
  />
);

export default DividerGallery;
