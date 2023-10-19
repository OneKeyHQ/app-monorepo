import { useState } from 'react';

import { XStack } from 'tamagui';

import { IconButton } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ActionIconButton = () => {
  const [spinning, setSpinning] = useState(false);
  const [disabled, setDisabled] = useState(false);
  return (
    <IconButton
      variant="secondary"
      name="PlaceholderOutline"
      spinning={spinning}
      disabled={disabled}
      onPress={() => {
        setSpinning(true);
        setDisabled(true);
        setTimeout(() => {
          setSpinning(false);
          setDisabled(false);
        }, 2000);
      }}
    />
  );
};

const IconButtonGallery = () => (
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
          <XStack space="$2" alignItems="center">
            <IconButton variant="secondary" name="PlaceholderOutline" />
            <IconButton variant="primary" name="PlaceholderOutline" />
            <IconButton variant="tertiary" name="PlaceholderOutline" />
            <IconButton variant="destructive" name="PlaceholderOutline" />
          </XStack>
        ),
      },
      {
        title: 'Sizes',
        element: (
          <XStack space="$2" alignItems="center">
            <IconButton
              variant="secondary"
              size="large"
              name="PlaceholderOutline"
            />
            <IconButton
              variant="secondary"
              size="medium"
              name="PlaceholderOutline"
            />
            <IconButton
              variant="secondary"
              size="small"
              name="PlaceholderOutline"
            />
          </XStack>
        ),
      },
      {
        title: 'Disabled & Loading',
        element: (
          <XStack space="$2" alignItems="center">
            <IconButton disabled name="PlaceholderOutline" />
            <ActionIconButton />
          </XStack>
        ),
      },
    ]}
  />
);

export default IconButtonGallery;
