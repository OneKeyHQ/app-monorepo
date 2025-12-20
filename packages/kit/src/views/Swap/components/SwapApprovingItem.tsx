import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Animated } from 'react-native';

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
  onComplete?: () => void;
}

const SwapApprovingItem = ({
  approvingTransaction,
  onComplete,
}: ISwapApprovingItemProps) => {
  const intl = useIntl();
  const themeVariant = useThemeVariant();
  const [containerWidth, setContainerWidth] = useState(0);
  const isResetApprove = useMemo(() => {
    return new BigNumber(approvingTransaction?.amount ?? '0').isZero();
  }, [approvingTransaction?.amount]);
  const estTime = useMemo(() => {
    if (approvingTransaction?.fromToken.networkId === 'evm--1') {
      return approvingIntervalSecondsEth;
    }
    return approvingIntervalSecondsDefault;
  }, [approvingTransaction?.fromToken.networkId]);

  const progressAnim = useRef(new Animated.Value(0));

  const startProgress = useCallback(
    (duration?: number) => {
      progressAnim.current.setValue(0);
      Animated.timing(progressAnim.current, {
        toValue: 1,
        duration: duration || 1000 * estTime,
        useNativeDriver: false,
      }).start();
    },
    [estTime],
  );

  const revertProgress = useCallback(() => {
    Animated.timing(progressAnim.current, {
      toValue: 0,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, []);

  const completeProgress = useCallback(() => {
    Animated.timing(progressAnim.current, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, []);

  const onCompleteRef = useRef(onComplete);
  if (onCompleteRef.current !== onComplete) {
    onCompleteRef.current = onComplete;
  }

  useEffect(() => {
    if (
      approvingTransaction?.txId &&
      approvingTransaction?.status === ESwapApproveTransactionStatus.PENDING
    ) {
      startProgress();
    } else if (
      !approvingTransaction?.txId ||
      approvingTransaction?.status === ESwapApproveTransactionStatus.FAILED ||
      approvingTransaction?.status === ESwapApproveTransactionStatus.CANCEL
    ) {
      revertProgress();
    } else if (
      approvingTransaction?.txId &&
      approvingTransaction?.status === ESwapApproveTransactionStatus.SUCCESS
    ) {
      completeProgress();
      if (!approvingTransaction?.resetApproveValue) {
        setTimeout(() => {
          onCompleteRef.current?.();
        }, 1000);
      }
    }
  }, [
    approvingTransaction?.txId,
    approvingTransaction?.status,
    approvingTransaction?.resetApproveValue,
    startProgress,
    revertProgress,
    completeProgress,
  ]);

  const approveLabel = useMemo(() => {
    if (isResetApprove) {
      return intl.formatMessage(
        { id: ETranslations.global_revoke_approve },
        { symbol: approvingTransaction?.fromToken.symbol },
      );
    }
    if (approvingTransaction?.resetApproveIsMax) {
      return `${intl.formatMessage({
        id: ETranslations.approve_edit_unlimited_amount,
      })} ${approvingTransaction?.fromToken.symbol}`;
    }
    return intl.formatMessage(
      { id: ETranslations.swap_approve_token },
      {
        num: approvingTransaction?.amount,
        token: approvingTransaction?.fromToken.symbol,
      },
    );
  }, [
    isResetApprove,
    approvingTransaction?.resetApproveIsMax,
    approvingTransaction?.amount,
    approvingTransaction?.fromToken.symbol,
    intl,
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
        const width = e.nativeEvent.layout.width + 10;
        setContainerWidth(width);
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: progressAnim.current.interpolate({
            inputRange: [0, 1],
            outputRange: [0, containerWidth],
          }),
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
            {approveLabel}
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
