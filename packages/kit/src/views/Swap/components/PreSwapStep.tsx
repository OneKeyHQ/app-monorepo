import { useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Icon,
  Image,
  LottieView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ESwapStepStatus,
  type ISwapStep,
} from '@onekeyhq/shared/types/swap/types';

interface IPreSwapStepProps {
  steps: ISwapStep[];
}

interface IRoundLoadingItemProps {
  stepTitle: string;
  isLoading: boolean;
  success: boolean;
  failed: boolean;
  canRetry: boolean;
  estimatedTime: number | string;
  onRetry: () => void;
}

const RoundLoadingItem = ({
  stepTitle,
  isLoading,
  estimatedTime,
  success,
  canRetry,
  onRetry,
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
          width={18}
          height={18}
          source={require('@onekeyhq/kit/assets/preSwapStepSuccess.png')}
        />
      );
    }
    if (failed) {
      return (
        <Image
          width={18}
          height={18}
          source={require('@onekeyhq/kit/assets/preSwapStepFailed.png')}
        />
      );
    }
    if (isLoading) {
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
    }
    return (
      <Image
        width={18}
        height={18}
        source={require('@onekeyhq/kit/assets/preSwapStepReady.png')}
      />
    );
  }, [success, failed, isLoading]);

  const rightComponent = useMemo(() => {
    if (isLoading && !success && !failed) {
      return (
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
      );
    }
    if (canRetry && failed) {
      return (
        <Button
          size="sm"
          type="plain"
          onPress={() => {
            onRetry();
          }}
        >
          Retry
        </Button>
      );
    }
    if (success) {
      return <Icon size="$6" name="CheckboxOutline" color="$iconSubdued" />;
    }
    return null;
  }, [isLoading, success, failed, canRetry, countdown, intl, onRetry]);

  return (
    <XStack justifyContent="space-between" alignItems="center">
      <XStack gap="$2" alignItems="center">
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
  return (
    <YStack gap="$1">
      {steps.map((step, index) => {
        return (
          <YStack key={step.type} gap="$1">
            <RoundLoadingItem
              onRetry={() => {
                console.log('retry');
              }}
              stepTitle={step.type}
              canRetry={!!step.canRetry}
              isLoading={
                step.status === ESwapStepStatus.PENDING ||
                step.status === ESwapStepStatus.LOADING
              }
              success={step.status === ESwapStepStatus.SUCCESS}
              failed={step.status === ESwapStepStatus.FAILED}
              estimatedTime={20}
            />
            {steps.length > 1 && index < steps.length - 1 ? (
              <Divider
                bg="$borderSubdued"
                vertical
                ml={9}
                height="$3"
                width="$1"
              />
            ) : null}
          </YStack>
        );
      })}
    </YStack>
  );
};

export default PreSwapStep;
