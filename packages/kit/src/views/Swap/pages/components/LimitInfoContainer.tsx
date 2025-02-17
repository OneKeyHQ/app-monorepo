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
    onLimitExpirationTimeChange,
    expirationTime,
  } = useSwapLimitRate();

  return (
    <XStack gap="$2">
      <YStack gap="$2">
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
      <YStack gap="$2" flex={1}>
        <SizableText> Expiry</SizableText>
        <Select
          title="Expiry"
          items={ESwapLimitOrderExpiryStepMap}
          onChange={onLimitExpirationTimeChange}
          value={expirationTime.toString()}
        />
      </YStack>
    </XStack>
  );
};

export default LimitInfoContainer;
