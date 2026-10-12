import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  ScrollView,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDustSweepItem } from '@onekeyhq/shared/types/swap/dustSweep';

import {
  DustSweepTokenRow,
  getDustSweepReasonMessage,
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
  onBack,
  onDone,
  maxHeight = 600,
}: {
  state: IDustSweepState;
  onBack: () => void;
  onDone: () => void;
  maxHeight?: number;
}) {
  const intl = useIntl();
  const openTransaction = async (item: IDustSweepItem, txId: string) => {
    try {
      await openTransactionDetailsUrl({
        networkId: item.token.networkId,
        txid: txId,
        openInExternal: true,
      });
    } catch {
      Toast.error({
        title: intl.formatMessage({ id: ETranslations.global_network_error }),
      });
    }
  };
  return (
    <YStack
      testID="dust-sweep-details"
      width="100%"
      height={Math.min(600, maxHeight)}
    >
      <XStack
        height={56}
        flexShrink={0}
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
          onPress={onBack}
          accessibilityLabel={intl.formatMessage({
            id: ETranslations.global_back,
          })}
        />
        <SizableText size="$headingLg" flex={1} textAlign="center" mr={24}>
          {intl.formatMessage({ id: ETranslations.global_details })}
        </SizableText>
      </XStack>
      <ScrollView flex={1} minHeight={0}>
        <YStack>
          {state.items.map((item) => {
            let reason: string | undefined;
            if (item.status === 'unknown')
              reason = intl.formatMessage({
                id: ETranslations.swap_review_tx_pending,
              });
            else if (item.reason)
              reason =
                item.message || getDustSweepReasonMessage(intl, item.reason);
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
                        testID={`dust-sweep-tx-${item.token.key}`}
                        size="$bodySm"
                        color="$textSubdued"
                        numberOfLines={1}
                        flexShrink={1}
                        cursor="pointer"
                        textDecorationLine="underline"
                        onPress={() => {
                          if (item.txId) void openTransaction(item, item.txId);
                        }}
                      >
                        {shortenTransactionId(item.txId)}
                      </SizableText>
                    ) : null}
                  </XStack>
                  {item.approvalTxIds?.map((txId) => (
                    <SizableText
                      key={txId}
                      testID={`dust-sweep-approval-${txId}`}
                      size="$bodySm"
                      color="$textSubdued"
                      cursor="pointer"
                      textDecorationLine="underline"
                      onPress={() => {
                        void openTransaction(item, txId);
                      }}
                    >
                      {intl.formatMessage({
                        id: ETranslations.global_approval,
                      })}{' '}
                      · {shortenTransactionId(txId)}
                    </SizableText>
                  ))}
                  {reason ? (
                    <SizableText
                      size="$bodySm"
                      color={
                        item.status === 'unknown'
                          ? '$textSubdued'
                          : '$textCritical'
                      }
                    >
                      {reason}
                    </SizableText>
                  ) : null}
                </YStack>
              </YStack>
            );
          })}
        </YStack>
      </ScrollView>
      <YStack px="$5" py="$4" flexShrink={0}>
        <Button
          testID="dust-sweep-details-done"
          variant="primary"
          height={46}
          minHeight={46}
          onPress={onDone}
        >
          {intl.formatMessage({ id: ETranslations.global_done })}
        </Button>
      </YStack>
    </YStack>
  );
}
