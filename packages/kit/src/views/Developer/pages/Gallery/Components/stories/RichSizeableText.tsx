import { SizableText, Stack, YStack } from '@onekeyhq/components';
import { RichSizeableText } from '@onekeyhq/components/src/content/RichSizeableText';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Layout } from './utils/Layout';

const RichSizeableTextGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="RichSizeableText"
    description="一个支持富文本格式和尺寸选项的文本组件"
    suggestions={[
      '用于显示带链接的格式化文本',
      '支持纯文本和翻译键',
      '可以处理自定义链接操作',
    ]}
    boundaryConditions={[
      '必须提供字符串或翻译键作为子元素',
      '链接列表必须与文本中的占位符匹配',
    ]}
    elements={[
      {
        title: 'Basic Usage',
        element: (
          <YStack gap="$4">
            <RichSizeableText>Simple text without formatting</RichSizeableText>

            <RichSizeableText size="$heading4xl">
              Large sized text
            </RichSizeableText>
          </YStack>
        ),
      },
      {
        title: 'With Translation Key',
        element: (
          <Stack>
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
          </Stack>
        ),
      },
      {
        title: 'With Links',
        element: (
          <Stack>
            <RichSizeableText
              linkList={{
                terms: {
                  url: 'https://onekey.so/terms',
                  onPress: () => {
                    console.log('Terms link pressed');
                  },
                },
                privacy: {
                  url: 'https://onekey.so/privacy',
                  onPress: () => {
                    console.log('Privacy link pressed');
                  },
                },
              }}
            >
              {
                'By continuing, you agree to our <link>terms</link> and <link>privacy</link> policy'
              }
            </RichSizeableText>
          </Stack>
        ),
      },
      {
        title: 'Custom Styling',
        element: (
          <YStack gap="$4">
            <RichSizeableText
              color="$red500"
              size="$heading2xl"
              textAlign="center"
            >
              Styled text with custom color and alignment
            </RichSizeableText>

            <RichSizeableText fontWeight="bold" size="$bodyLgMedium">
              Bold text with custom size
            </RichSizeableText>
          </YStack>
        ),
      },
    ]}
  />
);

export default RichSizeableTextGallery;
