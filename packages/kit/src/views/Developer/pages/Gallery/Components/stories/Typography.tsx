import { RichSizeableText, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { Layout } from './utils/Layout';

const TypographyGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="Typography"
    elements={[
      {
        title: 'Sans',
        element: (
          <YStack gap="$2">
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
          <YStack gap="$2">
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
          <YStack gap="$2">
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
          <YStack gap="$2">
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
                  url: undefined,
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
