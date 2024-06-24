import { RichSizeableText, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

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
      {
        title: 'Rich Text',
        element: (
          <YStack space="$2">
            <RichSizeableText
              linkList={{ a: { url: 'https://app.onekey.so' } }}
            >
              {'Hello<a> OneKey </a>World'}
            </RichSizeableText>
            <RichSizeableText
              linkList={{
                url0: { url: 'https://app.onekey.so', color: 'orange' },
                url1: {
                  url: 'https://google.com',
                  color: 'pink',
                },
                url2: {
                  color: 'green',
                  size: '$heading4xl',
                  onPress: () => {
                    alert('Open ChatGPT?');
                    openUrlExternal('https://chatgpt.com');
                  },
                },
              }}
            >
              {
                'Hello<url0> OneKey </url0><url1> Google </url1><url2> ChatGPT </url2>World'
              }
            </RichSizeableText>
            <RichSizeableText
              i18NValues={{
                // eslint-disable-next-line react/no-unstable-nested-components
                red: (text) => (
                  <SizableText color="$textCritical">{text}</SizableText>
                ),
                number: '10',
              }}
            >
              {ETranslations.hardware_onekey_lite_pin_error_desc}
            </RichSizeableText>
          </YStack>
        ),
      },
    ]}
  />
);

export default TypographyGallery;
