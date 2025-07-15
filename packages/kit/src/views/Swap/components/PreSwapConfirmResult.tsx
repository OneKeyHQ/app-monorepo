import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Image,
  LottieView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { ISwapStep } from '@onekeyhq/shared/types/swap/types';
import { ESwapStepStatus } from '@onekeyhq/shared/types/swap/types';

interface IPreSwapConfirmResultProps {
  lastStep: ISwapStep;
}

const PreSwapConfirmResult = ({ lastStep }: IPreSwapConfirmResultProps) => {
  const ref = useRef<any>(null);
  const [explorerUrl, setExplorerUrl] = useState<string>('');

  // 在组件渲染时获取 explorer URL
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
      return 'Swap Success';
    }
    if (lastStep.status === ESwapStepStatus.FAILED) {
      return 'Transaction Failed';
    }
    return 'Transaction Success';
  }, [lastStep.status]);
  console.log('swap__preSwapConfirmResult__lastStep.status', lastStep.status);
  return (
    <YStack alignItems="center" justifyContent="center" gap="$4">
      {lastStep.status === ESwapStepStatus.SUCCESS ? (
        <LottieView
          ref={ref}
          width="$30"
          height="$30"
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
            View On Explorer ({lastStep.txHash})
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
            Please try again or{' '}
          </SizableText>
          <SizableText
            size="$bodySm"
            color="$textInteractive"
            textDecorationLine="underline"
            onPress={() => openUrlExternal(lastStep.data?.supportUrl ?? '')}
            cursor="pointer"
          >
            contact support
          </SizableText>
        </XStack>
      ) : null}
      {lastStep.status === ESwapStepStatus.PENDING ? (
        <XStack alignItems="center" justifyContent="center" mt="$4">
          <SizableText size="$bodySm" color="$textInteractive">
            Leaving won’t stop the order. Check it in History.
          </SizableText>
        </XStack>
      ) : null}
    </YStack>
  );
};

export default PreSwapConfirmResult;
