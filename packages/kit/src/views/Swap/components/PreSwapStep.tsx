import { useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Image,
  LottieView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapStep } from '@onekeyhq/shared/types/swap/types';

interface IPreSwapStepProps {
  steps: ISwapStep[];
}

interface IRoundLoadingItemProps {
  stepTitle: string;
  isLoading: boolean;
  success: boolean;
  failed: boolean;
  estimatedTime: number | string;
}

const RoundLoadingItem = ({
  stepTitle,
  isLoading,
  estimatedTime,
  success,
  failed,
}: IRoundLoadingItemProps) => {
  const ref = useRef<any>(null);
  const intl = useIntl();

  const estimatedTimeNumber =
    typeof estimatedTime === 'string'
      ? parseInt(estimatedTime, 10) || 0
      : estimatedTime;

  const [countdown, setCountdown] = useState(estimatedTimeNumber);

  useEffect(() => {
    if (!isLoading || success || failed) {
      setCountdown(estimatedTimeNumber);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [isLoading, success, failed, estimatedTimeNumber]);

  // 当 estimatedTime 变化时重置倒计时
  useEffect(() => {
    setCountdown(estimatedTimeNumber);
  }, [estimatedTimeNumber]);

  const statusComponent = useMemo(() => {
    if (success) {
      return (
        <Image
          width={20}
          height={20}
          source={{
            uri: require('@onekeyhq/kit/assets/images/preSwapStepSuccess.png'),
          }}
        />
      );
    }
    if (failed) {
      return (
        <Image
          width={20}
          height={20}
          source={{
            uri: require('@onekeyhq/kit/assets/images/preSwapStepFailed.png'),
          }}
        />
      );
    }
    return (
      <LottieView
        ref={ref}
        width="$5"
        height="$5"
        autoPlay={isLoading}
        loop={isLoading}
        source={require('@onekeyhq/kit/assets/animations/round-loading.json')}
      />
    );
  }, [success, failed, isLoading]);

  return (
    <XStack justifyContent="space-between">
      <XStack>
        {statusComponent}
        <SizableText size="$bodyMd" color="$textSubdued">
          {stepTitle}
        </SizableText>
      </XStack>
      {isLoading && !success && !failed ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {countdown > 0
            ? intl.formatMessage(
                { id: ETranslations.swap_approve_token_est_time },
                { num: countdown },
              )
            : intl.formatMessage(
                { id: ETranslations.swap_approve_token_est_time },
                { num: countdown },
              )}
        </SizableText>
      ) : null}
    </XStack>
  );
};

const PreSwapStep = ({ steps }: IPreSwapStepProps) => {
  //   const ref = useRef<any>(null);

  const firstQuoteResult = steps[0].data;

  return (
    <YStack>
      <RoundLoadingItem
        stepTitle={firstQuoteResult?.info?.providerName || ''}
        isLoading
        success={false}
        failed={false}
        estimatedTime={20}
      />
    </YStack>
  );
};

export default PreSwapStep;
