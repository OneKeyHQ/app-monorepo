import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Button,
  Image,
  LottieView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { SUPPORT_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { ISwapStep, ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapStepStatus } from '@onekeyhq/shared/types/swap/types';

import { truncateMiddle } from '../utils/utils';

interface IPreSwapConfirmResultProps {
  lastStep: ISwapStep;
  fromToken?: ISwapToken;
  supportUrl?: string;
  onConfirm?: () => void;
}

const PreSwapConfirmResult = ({
  lastStep,
  fromToken,
  supportUrl,
  onConfirm,
}: IPreSwapConfirmResultProps) => {
  const [explorerUrl, setExplorerUrl] = useState<string>('');
  const intl = useIntl();
  useEffect(() => {
    const fetchExplorerUrl = async () => {
      if (!lastStep.txHash || !fromToken?.networkId) {
        setExplorerUrl('');
        return;
      }

      try {
        const url = await backgroundApiProxy.serviceExplorer.buildExplorerUrl({
          networkId: fromToken?.networkId,
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
  }, [lastStep.txHash, fromToken?.networkId]);

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
                <LottieView
                  source={require('@onekeyhq/kit/assets/animations/swap_order_pending.json')}
                  width={110}
                  height={110}
                  autoPlay
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
            <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
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
      {supportUrl && lastStep.status === ESwapStepStatus.FAILED ? (
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
            onPress={() => {
              if (supportUrl?.includes(SUPPORT_URL)) {
                void showIntercom();
              } else {
                openUrlExternal(supportUrl ?? '');
              }
            }}
          >
            {intl.formatMessage(
              {
                id: ETranslations.swap_review_tx_failed_2,
              },
              {
                url: supportUrl,
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
      <Button
        mt="$4"
        variant="primary"
        onPress={onConfirm}
        size="medium"
        width="100%"
      >
        {intl.formatMessage({
          id:
            lastStep.status === ESwapStepStatus.FAILED
              ? ETranslations.global_retry
              : ETranslations.global_done,
        })}
      </Button>
    </YStack>
  );
};

export default PreSwapConfirmResult;
