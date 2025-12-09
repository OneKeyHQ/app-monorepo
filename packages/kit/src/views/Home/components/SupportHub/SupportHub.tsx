import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IIconProps } from '@onekeyhq/components';
import {
  Button,
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { ONEKEY_SIFU_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { RichBlock } from '../RichBlock';

function SupportHubItem({
  icon,
  title,
  link,
}: {
  icon: IIconProps['name'];
  title: string;
  link: string;
}) {
  return (
    <XStack
      alignItems="center"
      gap="$2"
      px="$4"
      py="$3"
      bg="$bgSubdued"
      justifyContent="space-between"
      onPress={() => {
        openUrlExternal(link);
      }}
    >
      <XStack alignItems="center" gap="$2.5" flex={1}>
        <Stack borderRadius="$full" p="$2" bg="$bgStrong">
          <Icon name={icon} size="$6" />
        </Stack>
        <SizableText size="$bodyMdMedium">{title}</SizableText>
      </XStack>
      <Stack width="$4" height="$4">
        <Icon name="ArrowTopRightOutline" size="$4" color="$iconSubdued" />
      </Stack>
    </XStack>
  );
}

function SupportHub() {
  const intl = useIntl();

  const helpCenterCommonFaqLink = useHelpLink({
    path: '',
  });

  const securityFeaturesHelpLink = useHelpLink({
    path: '/articles/11461139',
  });
  const sendAndReceiveHelpLink = useHelpLink({
    path: '/articles/11461145',
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
              height={145}
              backgroundImage={require('@onekeyhq/kit/assets/wallet-add-money-bg-dark.png')}
              backgroundSize="cover"
              backgroundPosition="center"
              backgroundRepeat="no-repeat"
              justifyContent="center"
              px="$4"
              position="relative"
              onPress={() => {
                openUrlExternal(ONEKEY_SIFU_URL);
              }}
            >
              <Image
                position="absolute"
                top="0"
                left="0"
                source={require('@onekeyhq/kit/assets/sifu_banner.jpg')}
                width="100%"
                height="100%"
                resizeMode="cover"
              />
              <YStack width="70%">
                <SizableText size="$headingLg" flex={1}>
                  {intl.formatMessage({
                    id: ETranslations.wallet_approval_approval_details,
                  })}
                </SizableText>
                <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
                  {intl.formatMessage({
                    id: ETranslations.wallet_get_one_on_one_hardware_wallet_setup_help,
                  })}
                </SizableText>
              </YStack>
            </YStack>
          }
          contentContainerProps={{
            px: '$0',
            py: '$0',
          }}
        />
        <Stack flexDirection="column" gap="$3" flex={1}>
          <RichBlock
            blockContainerProps={{
              flex: 1,
            }}
            content={
              <SupportHubItem
                icon="ShieldOutline"
                title={intl.formatMessage({
                  id: ETranslations.global_security_features_of_onekey_app,
                })}
                link={securityFeaturesHelpLink}
              />
            }
            contentContainerProps={{
              px: '$0',
              py: '$0',
            }}
          />
          <RichBlock
            blockContainerProps={{
              flex: 1,
            }}
            content={
              <SupportHubItem
                icon="CoinsAddOutline"
                title={intl.formatMessage({
                  id: ETranslations.wallet_send_and_receive_cryptos,
                })}
                link={sendAndReceiveHelpLink}
              />
            }
            contentContainerProps={{
              px: '$0',
              py: '$0',
            }}
          />
        </Stack>
      </Stack>
    );
  }, [intl, securityFeaturesHelpLink, sendAndReceiveHelpLink]);

  return (
    <RichBlock
      title={intl.formatMessage({ id: ETranslations.settings_support_hub })}
      content={renderContent()}
      headerActions={
        <Button
          size="small"
          variant="tertiary"
          iconAfter="OpenOutline"
          color="$textSubdued"
          iconProps={{ color: '$iconSubdued' }}
          onPress={() => {
            openUrlExternal(helpCenterCommonFaqLink);
          }}
        >
          {intl.formatMessage({
            id: ETranslations.global_learn_more,
          })}
        </Button>
      }
      plainContentContainer
    />
  );
}

export { SupportHub };
