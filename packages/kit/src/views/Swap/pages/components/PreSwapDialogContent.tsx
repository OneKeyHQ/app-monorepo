import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, Divider, SizableText, YStack } from '@onekeyhq/components';
import { useSwapStepsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  type ESwapSlippageSegmentKey,
  ESwapStepStatus,
  type IFetchQuoteResult,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import PreSwapConfirmResult from '../../components/PreSwapConfirmResult';
import PreSwapInfoGroup from '../../components/PreSwapInfoGroup';
import PreSwapStep from '../../components/PreSwapStep';
import PreSwapTokenItem from '../../components/PreSwapTokenItem';

interface IPreSwapDialogContentProps {
  quoteResult: IFetchQuoteResult;
  fromTokenInfo?: ISwapToken;
  toTokenInfo?: ISwapToken;
  onConfirm: () => void;
  slippageItem: {
    key: ESwapSlippageSegmentKey;
    value: number;
  };
}

const PreSwapDialogContent = ({
  onConfirm,
  quoteResult,
  slippageItem,
  fromTokenInfo,
  toTokenInfo,
}: IPreSwapDialogContentProps) => {
  const intl = useIntl();

  const fromAmount = quoteResult?.fromAmount || '0';
  const toAmount = quoteResult?.toAmount || '0';
  const [swapSteps] = useSwapStepsAtom();
  const handleConfirm = () => {
    onConfirm();
  };

  const showResultContent = useMemo(() => {
    if (swapSteps.length > 0) {
      const lastStep = swapSteps[swapSteps.length - 1];
      return (
        lastStep.status !== ESwapStepStatus.READY &&
        lastStep.status !== ESwapStepStatus.LOADING
      );
    }
  }, [swapSteps]);

  if (showResultContent && swapSteps.length > 0) {
    return <PreSwapConfirmResult lastStep={swapSteps[swapSteps.length - 1]} />;
  }
  return (
    <YStack gap="$4">
      {/* You pay */}
      <SizableText size="$bodyLg" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.swap_page_from })}
      </SizableText>

      {/* From token item */}
      <PreSwapTokenItem token={fromTokenInfo} amount={fromAmount} />

      {/* You received */}
      <SizableText size="$bodyLg" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.swap_page_to })}
      </SizableText>

      {/* To token item */}
      <PreSwapTokenItem token={toTokenInfo} amount={toAmount} />

      <Divider />

      {swapSteps.length > 0 && swapSteps[0].status === ESwapStepStatus.READY ? (
        <>
          {/* Info items */}
          <PreSwapInfoGroup
            quoteResult={quoteResult}
            slippageItem={slippageItem}
          />
          {/* Primary button */}
          <Button variant="primary" onPress={handleConfirm} size="large">
            {intl.formatMessage({ id: ETranslations.transaction_confirm })}
          </Button>
        </>
      ) : (
        <PreSwapStep steps={swapSteps} />
      )}
    </YStack>
  );
};

export default PreSwapDialogContent;
