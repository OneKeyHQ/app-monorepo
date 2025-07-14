import { useIntl } from 'react-intl';

import { Button, Divider, SizableText, YStack } from '@onekeyhq/components';
import { useSwapStepsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ESwapSlippageSegmentKey,
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import PreSwapInfoGroup from '../../components/PreSwapInfoGroup';
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
    // 处理确认逻辑
    console.log('Confirm swap');
    onConfirm();
  };

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

      {/* Divider */}
      <Divider />

      {/* Info items */}
      <PreSwapInfoGroup quoteResult={quoteResult} slippageItem={slippageItem} />

      {/* Primary button */}
      <Button variant="primary" onPress={handleConfirm} size="large">
        {intl.formatMessage({ id: ETranslations.transaction_confirm })}
      </Button>
    </YStack>
  );
};

export default PreSwapDialogContent;
