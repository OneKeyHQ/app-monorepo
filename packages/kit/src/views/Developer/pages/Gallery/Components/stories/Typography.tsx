import { Text, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const TypographyGallery = () => (
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
        title: 'Sans',
        element: (
          <YStack space="$2">
            <Text variant="$heading5xl">heading5xl</Text>
            <Text variant="$heading4xl">heading4xl</Text>
            <Text variant="$heading3xl">heading3xl</Text>
            <Text variant="$heading2xl">heading2xl</Text>
            <Text variant="$headingXl">headingXl</Text>
            <Text variant="$headingLg">headingLg</Text>
            <Text variant="$headingMd">headingMd</Text>
            <Text variant="$headingSm">headingSm</Text>
            <Text variant="$headingXs">headingXs</Text>
            <Text variant="$bodyLg">bodyLg</Text>
            <Text variant="$bodyMd">bodyMd</Text>
            <Text variant="$bodySm">bodySm</Text>
            <Text variant="$bodyLgMedium">bodyLgMedium</Text>
            <Text variant="$bodyMdMedium">bodyMdMedium</Text>
            <Text variant="$bodySmMedium">bodySmMedium</Text>
          </YStack>
        ),
      },
      {
        title: 'Underline',
        element: (
          <YStack space="$2">
            <Text variant="$bodyLg" textDecorationLine="underline">
              `variant="$bodyLg" textDecorationLine="underline"`
            </Text>
            <Text variant="$bodyMd" textDecorationLine="underline">
              `variant="$bodyMd" textDecorationLine="underline"`
            </Text>
          </YStack>
        ),
      },
      {
        title: 'Colors',
        element: (
          <YStack space="$2">
            <Text>Default</Text>
            <Text color="$textSubdued">$textSubdued</Text>
            <Text color="$textDisabled">$textDisabled</Text>
            <Text color="$textInverse" backgroundColor="$bgInverse">
              $textInverse
            </Text>
            <Text color="$textInverseSubdued" backgroundColor="$bgInverse">
              $textInverseSubdued
            </Text>
            <Text color="$textOnColor" backgroundColor="$bgCriticalStrong">
              $textOnColor
            </Text>
            <Text color="$textSuccess">$textSuccess</Text>
            <Text color="$textInfo">$textInfo</Text>
            <Text color="$textCritical">$textCritical</Text>
            <Text color="$textCaution">$textCaution</Text>
            <Text color="$textInteractive">$textInteractive</Text>
            <Text color="$textPlaceholder">$textPlaceholder</Text>
          </YStack>
        ),
      },
    ]}
  />
);

export default TypographyGallery;
