import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
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
import { ESwapStepStatus } from '@onekeyhq/shared/types/swap/types';

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
    <YStack alignItems="center" justifyContent="center" gap="$4">
      {lastStep.status === ESwapStepStatus.SUCCESS ? (
        <LottieView
          ref={ref}
          width="$26"
          height="$26"
          autoPlay
          loop={false}
          source={require('@onekeyhq/kit/assets/animations/lottie_send_success_feedback.json')}
        />
      ) : (
        <>
          {lastStep.status === ESwapStepStatus.FAILED ? (
            <Image
              width={120}
              height={120}
              source={require('@onekeyhq/kit/assets/preSwapStepFailed.png')}
            />
          ) : (
            <Image
              source={require('@onekeyhq/kit/assets/preSwapPending.png')}
              width={120}
              height={120}
            />
          )}
        </>
      )}
      <SizableText size="$bodyMd" color="$textSubdued">
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
          paddingVertical="$1"
          paddingHorizontal="$2"
          borderRadius="$1"
          backgroundColor="$bgHover"
          opacity={explorerUrl ? 1 : 0.5}
        >
          <SizableText
            size="$bodySm"
            color="$textInteractive"
            textDecorationLine="underline"
          >
            {intl.formatMessage({
              id: ETranslations.swap_history_detail_view_in_browser,
            })}
            ({truncateMiddle(lastStep.txHash, 6, 4)})
          </SizableText>
        </XStack>
      ) : null}
      {lastStep.data?.supportUrl &&
      lastStep.status === ESwapStepStatus.FAILED ? (
        <XStack
          alignItems="center"
          justifyContent="center"
          paddingVertical="$1"
          paddingHorizontal="$2"
          mt="$4"
          borderRadius="$1"
          backgroundColor="$bgHover"
        >
          <SizableText size="$bodySm" color="$textInteractive">
            {intl.formatMessage({
              id: ETranslations.swap_review_tx_failed_1,
            })}
          </SizableText>
          <SizableText
            size="$bodySm"
            color="$textInteractive"
            textDecorationLine="underline"
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
          <SizableText size="$bodySm" color="$textInteractive">
            {intl.formatMessage({
              id: ETranslations.swap_review_tx_pending,
            })}
          </SizableText>
        </XStack>
      ) : null}
    </YStack>
  );
};

export default PreSwapConfirmResult;
