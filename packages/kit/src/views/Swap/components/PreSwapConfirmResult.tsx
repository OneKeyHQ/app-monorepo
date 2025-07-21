import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Image,
  LottieView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { ISwapStep } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapExtraStatus,
  ESwapStepStatus,
} from '@onekeyhq/shared/types/swap/types';

import { truncateMiddle } from '../utils/utils';

interface IPreSwapConfirmResultProps {
  lastStep: ISwapStep;
}

const PreSwapConfirmResult = ({ lastStep }: IPreSwapConfirmResultProps) => {
  const ref = useRef<any>(null);
  const [explorerUrl, setExplorerUrl] = useState<string>('');
  const intl = useIntl();
  useEffect(() => {
    const fetchExplorerUrl = async () => {
      if (!lastStep.txHash || !lastStep.data?.fromTokenInfo.networkId) {
        setExplorerUrl('');
        return;
      }

      try {
        const url = await backgroundApiProxy.serviceExplorer.buildExplorerUrl({
          networkId: lastStep.data?.fromTokenInfo.networkId,
          type: 'transaction',
          param: lastStep.txHash,
        });
        setExplorerUrl(url || '');
      } catch (error) {
        console.error('Failed to build explorer URL:', error);
        setExplorerUrl('');
      }
    };

    void fetchExplorerUrl();
  }, [lastStep.txHash, lastStep.data?.fromTokenInfo.networkId]);

  const handleViewOnExplorer = useCallback(() => {
    if (explorerUrl) {
      openUrlExternal(explorerUrl);
    }
  }, [explorerUrl]);

  const statusText = useMemo(() => {
    if (lastStep.status === ESwapStepStatus.SUCCESS) {
      return intl.formatMessage({
        id: ETranslations.swap_review_transaction_succeeded,
      });
    }
    if (lastStep.status === ESwapStepStatus.FAILED) {
      return intl.formatMessage({
        id: ETranslations.swap_review_transaction_failed,
      });
    }
    return intl.formatMessage({
      id: ETranslations.feedback_transaction_submitted,
    });
  }, [lastStep.status, intl]);
  return (
    <YStack alignItems="center" justifyContent="flex-end" h={300} flex={1}>
      <YStack justifyContent="center" alignItems="center" gap="$4" flex={1}>
        <AnimatePresence>
          {lastStep.status === ESwapStepStatus.SUCCESS ? (
            <YStack
              key={lastStep.status}
              animation="medium"
              enterStyle={{ scale: 0.5, opacity: 0.5 }}
            >
              <Image
                key={lastStep.status}
                width={110}
                height={110}
                source={require('@onekeyhq/kit/assets/preSwapStepSuccess.png')}
              />
            </YStack>
          ) : null}
        </AnimatePresence>
        {lastStep.status !== ESwapStepStatus.SUCCESS ? (
          <>
            {lastStep.status === ESwapStepStatus.FAILED ? (
              <YStack key={lastStep.status}>
                <Image
                  key={lastStep.status}
                  width={110}
                  height={110}
                  source={require('@onekeyhq/kit/assets/preSwapStepFailed.png')}
                />
              </YStack>
            ) : (
              <YStack key={lastStep.status}>
                <Image
                  key={lastStep.status}
                  source={require('@onekeyhq/kit/assets/preSwapPending2.png')}
                  width={110}
                  height={110}
                />
              </YStack>
            )}
          </>
        ) : null}
        <YStack gap="$2" alignItems="center" justifyContent="center">
          <SizableText size="$headingLg" color="$text">
            {statusText}
          </SizableText>
          {lastStep.status === ESwapStepStatus.FAILED ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {lastStep.errorMessage ?? ''}
            </SizableText>
          ) : null}
          {lastStep.txHash ? (
            <XStack
              onPress={handleViewOnExplorer}
              cursor="pointer"
              alignItems="center"
              justifyContent="center"
              opacity={explorerUrl ? 1 : 0.5}
            >
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                hoverStyle={{
                  color: '$text',
                }}
              >
                {intl.formatMessage({
                  id: ETranslations.swap_history_detail_view_in_browser,
                })}
                {` (${truncateMiddle(lastStep.txHash, 6, 4)})`}
              </SizableText>
            </XStack>
          ) : null}
        </YStack>
      </YStack>
      {lastStep.data?.supportUrl &&
      lastStep.status === ESwapStepStatus.FAILED ? (
        <XStack alignItems="center" justifyContent="center">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.swap_review_tx_failed_1,
            })}
          </SizableText>
          <SizableText
            size="$bodySm"
            hoverStyle={{
              color: '$text',
            }}
            textDecorationLine="underline"
            textDecorationColor="$textSubdued"
            textDecorationStyle="dotted"
            color="$textSubdued"
            cursor="pointer"
            onPress={() => openUrlExternal(lastStep.data?.supportUrl ?? '')}
          >
            {intl.formatMessage(
              {
                id: ETranslations.swap_review_tx_failed_2,
              },
              {
                url: lastStep.data?.supportUrl ?? '',
              },
            )}
          </SizableText>
        </XStack>
      ) : null}
      {lastStep.status === ESwapStepStatus.PENDING ? (
        <XStack alignItems="center" justifyContent="center" mt="$4">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.swap_review_tx_pending,
            })}
          </SizableText>
        </XStack>
      ) : null}
      {lastStep.status === ESwapStepStatus.SUCCESS ? (
        <XStack alignItems="center" justifyContent="center" mt="$4">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.swap_review_tx_success,
            })}
          </SizableText>
        </XStack>
      ) : null}
    </YStack>
  );
};

export default PreSwapConfirmResult;
