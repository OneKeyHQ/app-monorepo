import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IQuoteTip } from '@onekeyhq/shared/types/swap/types';

interface IPreSwapTipInfoProps {
  quoteShowTip: IQuoteTip;
  onConfirm: () => void;
  onCancel?: () => void;
}

const PreSwapTipInfo = ({
  quoteShowTip,
  onConfirm,
  onCancel,
}: IPreSwapTipInfoProps) => {
  const intl = useIntl();

  const handleLearnMore = useCallback(() => {
    if (quoteShowTip.link) {
      openUrlExternal(quoteShowTip.link);
    }
  }, [quoteShowTip.link]);

  return (
    <YStack gap="$3">
      {/* Title */}
      <SizableText size="$bodyMd" fontWeight={600}>
        {quoteShowTip.title}
      </SizableText>

      {/* Detail */}
      <SizableText size="$bodyMd" color="$textSubdued">
        {quoteShowTip.detail}
      </SizableText>

      {/* Learn More Link */}
      {quoteShowTip.link ? (
        <XStack alignSelf="flex-start" onPress={handleLearnMore}>
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            textDecorationLine="underline"
            textDecorationColor="$textSubdued"
            textDecorationStyle="dotted"
          >
            {intl.formatMessage({ id: ETranslations.global_learn_more })}
          </SizableText>
        </XStack>
      ) : null}

      {/* Action Buttons */}
      <XStack gap="$3" pt="$2">
        {quoteShowTip.showCancelButton ? (
          <Button flex={1} variant="secondary" size="medium" onPress={onCancel}>
            {intl.formatMessage({ id: ETranslations.global_cancel })}
          </Button>
        ) : null}
        <Button flex={1} variant="primary" size="medium" onPress={onConfirm}>
          {intl.formatMessage({ id: ETranslations.global_continue })}
        </Button>
      </XStack>
    </YStack>
  );
};

export { PreSwapTipInfo };
