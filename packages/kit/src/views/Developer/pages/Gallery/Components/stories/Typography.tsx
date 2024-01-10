import { SizableText, YStack } from '@onekeyhq/components';

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
            <SizableText size="$heading5xl">heading5xl</SizableText>
            <SizableText size="$heading4xl">heading4xl</SizableText>
            <SizableText size="$heading3xl">heading3xl</SizableText>
            <SizableText size="$heading2xl">heading2xl</SizableText>
            <SizableText size="$headingXl">headingXl</SizableText>
            <SizableText size="$headingLg">headingLg</SizableText>
            <SizableText size="$headingMd">headingMd</SizableText>
            <SizableText size="$headingSm">headingSm</SizableText>
            <SizableText size="$headingXs">headingXs</SizableText>
            <SizableText size="$bodyLg">bodyLg</SizableText>
            <SizableText size="$bodyMd">bodyMd</SizableText>
            <SizableText size="$bodySm">bodySm</SizableText>
            <SizableText size="$bodyLgMedium">bodyLgMedium</SizableText>
            <SizableText size="$bodyMdMedium">bodyMdMedium</SizableText>
            <SizableText size="$bodySmMedium">bodySmMedium</SizableText>
          </YStack>
        ),
      },
      {
        title: 'Underline',
        element: (
          <YStack space="$2">
            <SizableText size="$bodyLg" textDecorationLine="underline">
              `variant="$bodyLg" textDecorationLine="underline"`
            </SizableText>
            <SizableText size="$bodyMd" textDecorationLine="underline">
              `variant="$bodyMd" textDecorationLine="underline"`
            </SizableText>
          </YStack>
        ),
      },
      {
        title: 'Colors',
        element: (
          <YStack space="$2">
            <SizableText>Default</SizableText>
            <SizableText color="$textSubdued">$textSubdued</SizableText>
            <SizableText color="$textDisabled">$textDisabled</SizableText>
            <SizableText color="$textInverse" backgroundColor="$bgInverse">
              $textInverse
            </SizableText>
            <SizableText
              color="$textInverseSubdued"
              backgroundColor="$bgInverse"
            >
              $textInverseSubdued
            </SizableText>
            <SizableText
              color="$textOnColor"
              backgroundColor="$bgCriticalStrong"
            >
              $textOnColor
            </SizableText>
            <SizableText color="$textSuccess">$textSuccess</SizableText>
            <SizableText color="$textInfo">$textInfo</SizableText>
            <SizableText color="$textCritical">$textCritical</SizableText>
            <SizableText color="$textCaution">$textCaution</SizableText>
            <SizableText color="$textInteractive">$textInteractive</SizableText>
            <SizableText color="$textPlaceholder">$textPlaceholder</SizableText>
          </YStack>
        ),
      },
    ]}
  />
);

export default TypographyGallery;
