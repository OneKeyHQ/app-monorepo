import { useCallback } from 'react';
import type { ReactNode } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Dialog,
  Icon,
  Image,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useDialogInstance } from '@onekeyhq/components/src/composite/Dialog/hooks';
import {
  DialogTermsOfUseLink,
  ExplainerDialogScrollView,
} from '@onekeyhq/kit/src/components/TermsOfUseLink';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { privateSendHelpCenterUrl } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import type { IntlShape } from 'react-intl';

function PrivateSendGuideFeature({
  icon,
  children,
}: {
  icon: IKeyOfIcons;
  children: ReactNode;
}) {
  return (
    <XStack gap="$3" alignItems="flex-start">
      <XStack w="$6" h="$6" alignItems="center" justifyContent="center">
        <Icon name={icon} size="$5" color="$iconSubdued" />
      </XStack>
      <YStack flex={1}>{children}</YStack>
    </XStack>
  );
}

function PrivateSendGuideText({ children }: { children: ReactNode }) {
  return (
    <SizableText size="$bodyMd" color="$textSubdued">
      {children}
    </SizableText>
  );
}

function PrivateSendGuideDialogContent({ intl }: { intl: IntlShape }) {
  const dialogInstance = useDialogInstance();
  const handleReadMore = useCallback(async () => {
    await dialogInstance.close();
    openUrlExternal(privateSendHelpCenterUrl);
  }, [dialogInstance]);

  return (
    <YStack testID="private-send-guide-content" gap="$3">
      <Image
        w="100%"
        h={160}
        borderRadius="$3"
        source={require('@onekeyhq/kit/assets/private_send_guide.webp')}
        resizeMode="cover"
        // Image defaults autoplay to false on Android (OOM guard for lists);
        // this single animated webp in a dialog is safe to play everywhere.
        autoplay
      />
      <PrivateSendGuideFeature icon="BrokenLink2Outline">
        <PrivateSendGuideText>
          {intl.formatMessage({
            id: ETranslations.private_send_breaks_on_chain_link,
          })}
        </PrivateSendGuideText>
      </PrivateSendGuideFeature>
      <PrivateSendGuideFeature icon="ClockTimeHistoryOutline">
        <PrivateSendGuideText>
          {`${intl.formatMessage({
            id: ETranslations.private_send_funds_arrive_slower,
          })} `}
          <SizableText
            testID="private-send-guide-read-more"
            size="$bodyMd"
            color="$textInfo"
            textDecorationLine="underline"
            onPress={() => {
              void handleReadMore();
            }}
          >
            {intl.formatMessage({
              id: ETranslations.private_send_read_more,
            })}
          </SizableText>
        </PrivateSendGuideText>
      </PrivateSendGuideFeature>
      {/* A plain 1px line: the shared hairline Divider renders too faint to
          see inside this dialog on iOS. */}
      <YStack my="$2" h="$px" bg="$borderSubdued" />
      <PrivateSendGuideFeature icon="BuildingsOutline">
        <PrivateSendGuideText>
          {intl.formatMessage({
            id: ETranslations.private_send_guide_third_party__title,
          })}
        </PrivateSendGuideText>
        <PrivateSendGuideText>
          {intl.formatMessage({
            id: ETranslations.private_send_guide_third_party__desc,
          })}
        </PrivateSendGuideText>
      </PrivateSendGuideFeature>
      <PrivateSendGuideFeature icon="ShieldCheckDoneOutline">
        <PrivateSendGuideText>
          {intl.formatMessage({
            id: ETranslations.private_send_guide_compliance__title,
          })}
        </PrivateSendGuideText>
        <PrivateSendGuideText>
          {intl.formatMessage({
            id: ETranslations.private_send_guide_compliance__desc,
          })}
        </PrivateSendGuideText>
      </PrivateSendGuideFeature>
      <DialogTermsOfUseLink intl={intl} testID="private-send-guide-terms" />
    </YStack>
  );
}

export function showPrivateSendGuideDialog({ intl }: { intl: IntlShape }) {
  return Dialog.show({
    title: intl.formatMessage({
      id: ETranslations.private_send_private_send,
    }),
    showCancelButton: false,
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_got_it,
    }),
    renderContent: (
      <ExplainerDialogScrollView>
        <PrivateSendGuideDialogContent intl={intl} />
      </ExplainerDialogScrollView>
    ),
  });
}
