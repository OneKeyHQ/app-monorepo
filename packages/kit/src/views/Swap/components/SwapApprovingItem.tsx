import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  approvingIntervalSecondsDefault,
  approvingIntervalSecondsEth,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapApproveTransactionStatus,
  type ISwapApproveTransaction,
} from '@onekeyhq/shared/types/swap/types';

import { Token } from '../../../components/Token';
import { useThemeVariant } from '../../../hooks/useThemeVariant';

interface ISwapApprovingItemProps {
  approvingTransaction?: ISwapApproveTransaction;
  progress: number;
  onComplete?: () => void;
}

const SwapApprovingItem = ({
  approvingTransaction,
  progress = 1,
  onComplete,
}: ISwapApprovingItemProps) => {
  const intl = useIntl();
  const themeVariant = useThemeVariant();
  const [containerWidth, setContainerWidth] = useState(0);
  const [currentProgress, setCurrentProgress] = useState(0);
  const isResetApprove = useMemo(() => {
    return new BigNumber(approvingTransaction?.amount ?? '0').isZero();
  }, [approvingTransaction]);
  const estTime = useMemo(() => {
    if (approvingTransaction?.fromToken.networkId === 'evm--1') {
      return approvingIntervalSecondsEth;
    }
    return approvingIntervalSecondsDefault;
  }, [approvingTransaction]);
  const [animationDuration, setAnimationDuration] = useState(1000 * estTime);

  // 开始动画
  const startProgress = useCallback(
    (duration?: number) => {
      setAnimationDuration(duration || 1000 * estTime);
      setCurrentProgress(progress);
    },
    [estTime, progress],
  );

  // 回退动画
  const revertProgress = useCallback(() => {
    setAnimationDuration(1000);
    setCurrentProgress(0);
  }, []);

  // 立即完成
  const completeProgress = useCallback(() => {
    setAnimationDuration(1000);
    setCurrentProgress(1);
  }, []);

  useEffect(() => {
    if (
      approvingTransaction?.txId &&
      approvingTransaction?.status === ESwapApproveTransactionStatus.PENDING
    ) {
      startProgress();
    } else if (
      approvingTransaction?.txId &&
      (approvingTransaction?.status === ESwapApproveTransactionStatus.FAILED ||
        approvingTransaction?.status === ESwapApproveTransactionStatus.CANCEL)
    ) {
      revertProgress();
    } else if (
      approvingTransaction?.txId &&
      approvingTransaction?.status === ESwapApproveTransactionStatus.SUCCESS
    ) {
      completeProgress();
      setTimeout(() => {
        onComplete?.();
      }, 1000);
    }
  }, [
    approvingTransaction,
    startProgress,
    revertProgress,
    completeProgress,
    onComplete,
  ]);

  return (
    <XStack
      borderRadius="$2"
      p="$2.5"
      backgroundColor={themeVariant === 'light' ? '#F9F9F9E5' : '#1B1B1BCC'}
      justifyContent="space-between"
      alignItems="center"
      position="relative"
      overflow="hidden"
      onLayout={(e) => {
        const width = e.nativeEvent.layout.width;
        setContainerWidth(width);
      }}
    >
      <MotiView
        from={{
          width: 0,
        }}
        animate={{
          width: containerWidth * currentProgress,
        }}
        transition={{
          type: 'timing',
          duration: animationDuration,
        }}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          backgroundColor: '#44D62C80',
          opacity: 0.2,
        }}
      />
      <XStack alignItems="center" gap="$2">
        <Token
          size="sm"
          tokenImageUri={approvingTransaction?.fromToken.logoURI}
          networkImageUri={approvingTransaction?.fromToken.networkLogoURI}
          showNetworkIcon
        />
        <YStack>
          <SizableText size="$bodyMd" maxWidth={182}>
            {isResetApprove
              ? intl.formatMessage(
                  { id: ETranslations.global_revoke_approve },
                  {
                    symbol: approvingTransaction?.fromToken.symbol,
                  },
                )
              : intl.formatMessage(
                  { id: ETranslations.swap_approve_token },
                  {
                    num: approvingTransaction?.amount,
                    token: approvingTransaction?.fromToken.symbol,
                  },
                )}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {`to ${approvingTransaction?.providerName ?? ''}`}
          </SizableText>
        </YStack>
      </XStack>
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage(
          { id: ETranslations.swap_approve_token_est_time },
          { num: estTime },
        )}
      </SizableText>
    </XStack>
  );
};

export default SwapApprovingItem;
