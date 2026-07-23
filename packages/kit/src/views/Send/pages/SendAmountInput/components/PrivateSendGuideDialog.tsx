import type { ReactNode } from 'react';

import {
  Dialog,
  Icon,
  Image,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { privateSendHelpCenterUrl } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import type { IntlShape } from 'react-intl';

function PrivateSendGuideFeature({
  icon,
  children,
}: {
  icon: 'BrokenLink2Outline' | 'EyeOffSolid' | 'ClockTimeHistoryOutline';
  children: ReactNode;
}) {
  return (
    <XStack gap="$3" alignItems="flex-start">
      <XStack w="$6" h="$6" alignItems="center" justifyContent="center">
        <Icon name={icon} size="$5" color="$iconSubdued" />
      </XStack>
      <SizableText flex={1} size="$bodyMd" color="$textSubdued">
        {children}
      </SizableText>
    </XStack>
  );
}

export function showPrivateSendGuideDialog({ intl }: { intl: IntlShape }) {
  return Dialog.show({
    title: intl.formatMessage({
      id: ETranslations.private_send_send_without_trace_title,
    }),
    showCancelButton: false,
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_got_it,
    }),
    renderContent: (
      <YStack testID="private-send-guide-content" gap="$3">
        <Image
          w="100%"
          h={160}
          borderRadius="$3"
          source={require('@onekeyhq/kit/assets/private_send_guide.webp')}
          resizeMode="cover"
        />
        <PrivateSendGuideFeature icon="BrokenLink2Outline">
          {intl.formatMessage({
            id: ETranslations.private_send_breaks_on_chain_link,
          })}
        </PrivateSendGuideFeature>
        <PrivateSendGuideFeature icon="EyeOffSolid">
          {intl.formatMessage({
            id: ETranslations.private_send_third_parties_cant_trace,
          })}
        </PrivateSendGuideFeature>
        <PrivateSendGuideFeature icon="ClockTimeHistoryOutline">
          {`${intl.formatMessage({
            id: ETranslations.private_send_funds_arrive_slower,
          })} `}
          <SizableText
            size="$bodyMd"
            color="$textInfo"
            textDecorationLine="underline"
            onPress={() => openUrlExternal(privateSendHelpCenterUrl)}
          >
            {intl.formatMessage({
              id: ETranslations.private_send_read_more,
            })}
          </SizableText>
        </PrivateSendGuideFeature>
      </YStack>
    ),
  });
}
