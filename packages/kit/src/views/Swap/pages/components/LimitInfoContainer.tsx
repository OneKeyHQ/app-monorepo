import {
  NumberSizeableText,
  Select,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  ESwapLimitOrderExpiryStepMap,
  type IFetchQuoteResult,
} from '@onekeyhq/shared/types/swap/types';

import LimitRateInput from '../../components/LimitRateInput';
import { useSwapLimitRate } from '../../hooks/useSwapLimitRate';

interface ILimitInfoContainerProps {
  quoteResult?: IFetchQuoteResult;
}

const LimitInfoContainer = ({ quoteResult }: ILimitInfoContainerProps) => {
  const { fromTokenInfo, toTokenInfo } = quoteResult ?? {};
  const {
    onLimitRateChange,
    limitPriceUseRate,
    onSetMarketPrice,
    limitPriceSetReverse,
    onChangeReverse,
    limitPriceEqualMarketPrice,
    limitPriceMarketRate,
  } = useSwapLimitRate();

  return (
    <YStack gap="$2" p="$2" bg="$bgSubdued" borderRadius="$3">
      <XStack justifyContent="space-between">
        <SizableText> Limit price</SizableText>
        <XStack>
          <SizableText>Market:</SizableText>
          <NumberSizeableText
            formatter="balance"
            {...(!limitPriceEqualMarketPrice
              ? {
                  textDecorationLine: 'underline',
                  cursor: 'pointer',
                  onPress: onSetMarketPrice,
                }
              : {})}
          >
            {limitPriceMarketRate}
          </NumberSizeableText>
        </XStack>
      </XStack>
      <LimitRateInput
        limitPriceRateValue={
          limitPriceSetReverse
            ? limitPriceUseRate.reverseRate
            : limitPriceUseRate.rate
        }
        onReverseChange={onChangeReverse}
        reverse={limitPriceSetReverse}
        onChangeText={onLimitRateChange}
        fromTokenInfo={fromTokenInfo}
        toTokenInfo={toTokenInfo}
      />
    </YStack>
  );
};

export default LimitInfoContainer;
