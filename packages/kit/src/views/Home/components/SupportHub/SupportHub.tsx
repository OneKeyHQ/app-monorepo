import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IIconProps } from '@onekeyhq/components';
import {
  Icon,
  Image,
  SizableText,
  Stack,
  Theme,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ONEKEY_SIFU_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { RichBlock } from '../RichBlock';

function SupportHubItem({
  icon,
  title,
  link,
  onPress,
}: {
  icon: IIconProps['name'];
  title: string;
  link?: string;
  onPress?: () => void;
}) {
  return (
    <XStack
      alignItems="center"
      gap="$2"
      px="$4"
      py="$3"
      bg="$bgSubdued"
      justifyContent="space-between"
      flex={1}
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      onPress={
        link
          ? () => {
              openUrlExternal(link);
            }
          : onPress
      }
    >
      <XStack alignItems="center" gap="$2.5" flex={1}>
        <Stack borderRadius="$full" p="$2" bg="$bgStrong">
          <Icon name={icon} size="$6" />
        </Stack>
        <SizableText size="$bodyMdMedium">{title}</SizableText>
      </XStack>
      {link ? (
        <Stack width="$4" height="$4">
          <Icon name="ArrowTopRightOutline" size="$4" color="$iconSubdued" />
        </Stack>
      ) : null}
    </XStack>
  );
}

function SupportHub() {
  const intl = useIntl();
  const themeVariant = useThemeVariant();

  const helpCenterCommonFaqLink = useHelpLink({
    path: '',
  });

  const renderContent = useCallback(() => {
    return (
      <Stack flexDirection="row" $md={{ flexDirection: 'column' }} gap="$3">
        <RichBlock
          blockContainerProps={{
            flex: 1,
          }}
          content={
            <YStack
              height={151}
              justifyContent="center"
              px="$4"
              position="relative"
              onPress={() => {
                openUrlExternal(
                  `${ONEKEY_SIFU_URL}/?utm_source=app_support_hub`,
                );
              }}
            >
              <Image
                position="absolute"
                top="0"
                left="0"
                bottom="0"
                right="0"
                source={require('@onekeyhq/kit/assets/sifu_bg.jpg')}
                resizeMode="cover"
                zIndex={0}
                opacity={themeVariant === 'dark' ? 0.9 : 1}
              />
              <Theme name="light">
                <YStack width="60%" zIndex={99} position="absolute" left="$4">
                  <SizableText size="$headingLg" flex={1}>
                    {intl.formatMessage({
                      id: ETranslations.wallet_onekey_sifu,
                    })}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
                    {intl.formatMessage({
                      id: ETranslations.wallet_get_one_on_one_hardware_wallet_setup_help,
                    })}
                  </SizableText>
                </YStack>
              </Theme>
            </YStack>
          }
          contentContainerProps={{
            px: '$0',
            py: '$0',
            outlineWidth: 1,
            outlineStyle: 'solid',
            outlineColor: '$neutral2',
          }}
        />
        <Stack
          flexDirection="column"
          gap="$3"
          flex={1}
          $gtMd={{ flexBasis: 0 }}
        >
          <RichBlock
            blockContainerProps={{
              flex: 1,
            }}
            content={
              <SupportHubItem
                icon="HelpSupportOutline"
                title={intl.formatMessage({
                  id: ETranslations.global_contact_us,
                })}
                onPress={() => {
                  void showIntercom();
                }}
              />
            }
            contentContainerProps={{
              px: '$0',
              py: '$0',
              flex: 1,
            }}
          />
          <RichBlock
            blockContainerProps={{
              flex: 1,
            }}
            content={
              <SupportHubItem
                icon="BookOpenOutline"
                title={intl.formatMessage({
                  id: ETranslations.settings_help_center,
                })}
                link={helpCenterCommonFaqLink}
              />
            }
            contentContainerProps={{
              px: '$0',
              py: '$0',
              flex: 1,
            }}
          />
        </Stack>
      </Stack>
    );
  }, [intl, helpCenterCommonFaqLink, themeVariant]);

  return (
    <RichBlock
      title={intl.formatMessage({ id: ETranslations.settings_support_hub })}
      content={renderContent()}
      plainContentContainer
    />
  );
}

export { SupportHub };
