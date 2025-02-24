import { useIntl } from 'react-intl';

import { Badge, SizableText, XStack, YStack } from '@onekeyhq/components';
import {
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { LimitMarketUpPercentages } from '@onekeyhq/shared/types/swap/types';

import LimitRateInput from '../../components/LimitRateInput';
import { useSwapLimitRate } from '../../hooks/useSwapLimitRate';

const LimitInfoContainer = () => {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const {
    onLimitRateChange,
    limitPriceUseRate,
    onSetMarketPrice,
    limitPriceSetReverse,
    onChangeReverse,
  } = useSwapLimitRate();
  const intl = useIntl();

  return (
    <YStack gap="$2" p="$4" bg="$bgSubdued" borderRadius="$3">
      <XStack justifyContent="space-between">
        <SizableText color="$textSubdued" size="$bodyMd">
          {intl.formatMessage({ id: ETranslations.Limit_limit_price })}
        </SizableText>
        <XStack alignItems="center" gap="$1">
          {LimitMarketUpPercentages.map((percentage) => (
            <Badge
              key={percentage}
              bg="$bgApp"
              borderRadius="$2.5"
              borderWidth={1}
              borderColor="$borderSubdued"
              onPress={() => onSetMarketPrice(percentage)}
              hoverStyle={{
                bg: '$bgStrongHover',
              }}
              pressStyle={{
                bg: '$bgStrongActive',
              }}
            >
              {percentage === 0
                ? intl.formatMessage({ id: ETranslations.Limit_market })
                : `+${percentage}%`}
            </Badge>
          ))}
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
        fromTokenInfo={fromToken}
        toTokenInfo={toToken}
      />
    </YStack>
  );
};

export default LimitInfoContainer;
