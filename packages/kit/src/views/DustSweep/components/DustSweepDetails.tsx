import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDustSweepItem } from '@onekeyhq/shared/types/swap/dustSweep';

import {
  DustSweepTokenRow,
  dustSweepReasonMessages,
} from './DustSweepTokenRow';

import type { IDustSweepState } from '../stateMachine';

function shortenTransactionId(txId: string) {
  if (txId.length <= 14) return txId;
  return `${txId.slice(0, 7)}…${txId.slice(-7)}`;
}

function getStatusLabel(
  item: IDustSweepItem,
  intl: ReturnType<typeof useIntl>,
) {
  if (item.status === 'success')
    return intl.formatMessage({ id: ETranslations.label_converted });
  if (item.status === 'skipped')
    return intl.formatMessage({ id: ETranslations.label_skipped });
  if (item.status === 'failed')
    return intl.formatMessage({ id: ETranslations.global_failed });
  return intl.formatMessage({ id: ETranslations.global_pending });
}

export function DustSweepDetails({
  state,
  onClose,
}: {
  state: IDustSweepState;
  onClose: () => void;
}) {
  const intl = useIntl();
  return (
    <YStack testID="dust-sweep-details" width="100%" height={600}>
      <XStack
        height={56}
        px="$5"
        alignItems="center"
        borderBottomWidth={1}
        borderColor="$borderSubdued"
      >
        <IconButton
          testID="dust-sweep-details-back"
          icon="ChevronLeftOutline"
          variant="tertiary"
          width={24}
          height={28}
          minHeight={28}
          mx={0}
          my={0}
          p={0}
          onPress={onClose}
          accessibilityLabel={intl.formatMessage({
            id: ETranslations.global_back,
          })}
        />
        <SizableText size="$headingLg" flex={1} textAlign="center" mr={24}>
          {intl.formatMessage({ id: ETranslations.global_details })}
        </SizableText>
      </XStack>
      <ScrollView flex={1}>
        <YStack>
          {state.items.map((item) => {
            const reason = item.reason
              ? item.message || dustSweepReasonMessages[item.reason]
              : undefined;
            return (
              <YStack
                key={item.token.key}
                borderBottomWidth={1}
                borderColor="$borderSubdued"
              >
                <DustSweepTokenRow token={item.token} item={item} />
                <YStack px="$5" pb="$3" gap="$1">
                  <XStack justifyContent="space-between" gap="$3">
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {getStatusLabel(item, intl)}
                    </SizableText>
                    {item.txId ? (
                      <SizableText
                        size="$bodySm"
                        color="$textSubdued"
                        numberOfLines={1}
                        flexShrink={1}
                      >
                        {shortenTransactionId(item.txId)}
                      </SizableText>
                    ) : null}
                  </XStack>
                  {reason ? (
                    <SizableText size="$bodySm" color="$textCritical">
                      {reason}
                    </SizableText>
                  ) : null}
                </YStack>
              </YStack>
            );
          })}
        </YStack>
      </ScrollView>
      <YStack px="$5" py="$4">
        <Button
          testID="dust-sweep-details-done"
          variant="primary"
          height={46}
          minHeight={46}
          onPress={onClose}
        >
          {intl.formatMessage({ id: ETranslations.global_done })}
        </Button>
      </YStack>
    </YStack>
  );
}
