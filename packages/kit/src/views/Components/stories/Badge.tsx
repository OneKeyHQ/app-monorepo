import { Badge, Stack, XStack } from '@onekeyhq/components';

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
        title: '默认状态',
        element: (
          <Stack space="$1">
            <XStack space="$1">
              <Badge type="default" size="sm">
                Badge
              </Badge>
              <Badge type="success" size="sm">
                Badge
              </Badge>
              <Badge type="info" size="sm">
                Badge
              </Badge>
              <Badge type="warning" size="sm">
                Badge
              </Badge>
              <Badge type="critical" size="sm">
                Badge
              </Badge>
            </XStack>
            <XStack space="$1">
              <Badge type="default" size="lg">
                Badge
              </Badge>
              <Badge type="success" size="lg">
                Badge
              </Badge>
              <Badge type="info" size="lg">
                Badge
              </Badge>
              <Badge type="warning" size="lg">
                Badge
              </Badge>
              <Badge type="critical" size="lg">
                Badge
              </Badge>
            </XStack>
          </Stack>
        ),
      },
    ]}
  />
);

export default ButtonsGallery;
