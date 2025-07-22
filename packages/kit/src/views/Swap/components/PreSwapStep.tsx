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
  onRetry: () => void;
}

interface IRoundLoadingItemProps {
  stepTitle: string;
  isLoading: boolean;
  success: boolean;
  failed: boolean;
  canRetry: boolean;
  stepSubTitle: string;
  onRetry: () => void;
}

const RoundLoadingItem = ({
  stepTitle,
  isLoading,
  stepSubTitle,
  success,
  canRetry,
  onRetry,
  failed,
}: IRoundLoadingItemProps) => {
  const ref = useRef<any>(null);
  const intl = useIntl();

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
          {stepSubTitle}
        </SizableText>
      );
    }
    if (canRetry && failed) {
      return (
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          hoverStyle={{
            color: '$text',
            size: '$bodySmMedium',
          }}
          onPress={() => {
            onRetry();
          }}
          cursor="pointer"
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </SizableText>
      );
    }
    return null;
  }, [isLoading, success, failed, canRetry, stepSubTitle, intl, onRetry]);

  return (
    <XStack justifyContent="space-between" alignItems="center">
      <XStack gap="$2" alignItems="center">
        {statusComponent}
        <SizableText size="$bodyMd" color="$text">
          {stepTitle}
        </SizableText>
      </XStack>
      {rightComponent}
    </XStack>
  );
};

const PreSwapStep = ({ steps, onRetry }: IPreSwapStepProps) => {
  return (
    <YStack gap="$1">
      {steps.map((step, index) => {
        return (
          <YStack key={step.type} gap="$1">
            <RoundLoadingItem
              onRetry={onRetry}
              stepSubTitle={step.stepSubTitle ?? ''}
              stepTitle={step.stepTitle ?? '-'}
              canRetry={!!step.canRetry}
              isLoading={
                step.status === ESwapStepStatus.PENDING ||
                step.status === ESwapStepStatus.LOADING
              }
              success={step.status === ESwapStepStatus.SUCCESS}
              failed={step.status === ESwapStepStatus.FAILED}
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
