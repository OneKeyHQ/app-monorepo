import { useCallback, useEffect, useRef, useState } from 'react';

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
  status: 'success' | 'failed';
  successTxHash?: string;
  networkId?: string;
  errorMessage?: string;
}

const PreSwapConfirmResult = ({
  status,
  successTxHash,
  networkId,
  errorMessage,
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
        <Image
          source={{
            uri: require('@onekeyhq/kit/assets/images/preSwapStepFailed.png'),
          }}
          width="$30"
          height="$30"
        />
      )}
      <SizableText size="$bodyMd" color="$textSubdued">
        {status === 'success' ? 'Transaction Success' : 'Transaction Failed'}
      </SizableText>
      {status === 'failed' ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {errorMessage ?? ''}
        </SizableText>
      ) : null}
      {status === 'success' && successTxHash ? (
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
    </YStack>
  );
};

export default PreSwapConfirmResult;
