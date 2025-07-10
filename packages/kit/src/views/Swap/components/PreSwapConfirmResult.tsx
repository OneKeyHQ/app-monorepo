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

interface IPreSwapConfirmResultProps {
  status: 'success' | 'failed' | 'pending';
  successTxHash?: string;
  networkId?: string;
  errorMessage?: string;
  supportUrl?: string;
}

const PreSwapConfirmResult = ({
  status,
  successTxHash,
  networkId,
  errorMessage,
  supportUrl,
}: IPreSwapConfirmResultProps) => {
  const ref = useRef<any>(null);
  const [explorerUrl, setExplorerUrl] = useState<string>('');

  // 在组件渲染时获取 explorer URL
  useEffect(() => {
    const fetchExplorerUrl = async () => {
      if (!successTxHash || !networkId) {
        setExplorerUrl('');
        return;
      }

      try {
        const url = await backgroundApiProxy.serviceExplorer.buildExplorerUrl({
          networkId,
          type: 'transaction',
          param: successTxHash,
        });
        setExplorerUrl(url || '');
      } catch (error) {
        console.error('Failed to build explorer URL:', error);
        setExplorerUrl('');
      }
    };

    void fetchExplorerUrl();
  }, [successTxHash, networkId]);

  const handleViewOnExplorer = useCallback(() => {
    if (explorerUrl) {
      openUrlExternal(explorerUrl);
    }
  }, [explorerUrl]);

  const statusText = useMemo(() => {
    if (status === 'success') {
      return 'Swap Success';
    }
    if (status === 'failed') {
      return 'Transaction Failed';
    }
    return 'Transaction Success';
  }, [status]);

  return (
    <YStack alignItems="center" justifyContent="center" gap="$4">
      {status === 'success' ? (
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
          {status === 'failed' ? (
            <Image
              source={{
                uri: require('@onekeyhq/kit/assets/images/preSwapStepFailed.png'),
              }}
              width="$30"
              height="$30"
            />
          ) : (
            <Image
              source={{
                uri: require('@onekeyhq/kit/assets/images/preSwapPending.png'),
              }}
              width="$30"
              height="$30"
            />
          )}
        </>
      )}
      <SizableText size="$bodyMd" color="$textSubdued">
        {statusText}
      </SizableText>
      {status === 'failed' ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {errorMessage ?? ''}
        </SizableText>
      ) : null}
      {successTxHash ? (
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
            View On Explorer ({successTxHash})
          </SizableText>
        </XStack>
      ) : null}
      {supportUrl && status === 'failed' ? (
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
            onPress={() => openUrlExternal(supportUrl)}
            cursor="pointer"
          >
            contact support
          </SizableText>
        </XStack>
      ) : null}
      {status === 'pending' ? (
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
