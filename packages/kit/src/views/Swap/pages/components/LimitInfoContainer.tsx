import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Badge, SizableText, XStack, YStack } from '@onekeyhq/components';
import {
  useRateDifferenceAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ESwapTabSwitchType,
  LimitMarketUpPercentages,
} from '@onekeyhq/shared/types/swap/types';

import LimitRateInput from '../../components/LimitRateInput';
import { useSwapLimitRate } from '../../hooks/useSwapLimitRate';

const LimitInfoContainer = () => {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [rateDifference] = useRateDifferenceAtom();
  const {
    onLimitRateChange,
    limitPriceUseRate,
    onSetMarketPrice,
    limitPriceSetReverse,
    onChangeReverse,
    limitPriceEqualMarketPrice,
  } = useSwapLimitRate();
  const intl = useIntl();
  const checkEqualMarketPrice = useCallback(
    (percentage: number) => {
      const equalResult = limitPriceEqualMarketPrice.find(
        (item) => item.percentage === percentage,
      );
      return equalResult?.equal;
    },
    [limitPriceEqualMarketPrice],
  );

  const valueMoreComponent = useMemo(() => {
    if (rateDifference && swapTypeSwitch === ESwapTabSwitchType.LIMIT) {
      let color = '$textSubdued';
      if (rateDifference.value.startsWith('-')) {
        color = '$textCritical';
      }
      if (rateDifference.value.startsWith('+')) {
        color = '$textSuccess';
      }
      return (
        <XStack alignItems="center">
          <SizableText size="$bodyMd" color={color}>
            (
          </SizableText>
          <SizableText size="$bodyMd" color={color}>
            {rateDifference.value}
          </SizableText>
          <SizableText size="$bodyMd" color={color}>
            )
          </SizableText>
        </XStack>
      );
    }
    return null;
  }, [rateDifference, swapTypeSwitch]);

  return (
    <YStack gap="$2" p="$4" bg="$bgSubdued" borderRadius="$3">
      <XStack justifyContent="space-between">
        <XStack alignItems="center" gap="$1">
          <SizableText color="$textSubdued" size="$bodyMd">
            {intl.formatMessage({ id: ETranslations.Limit_limit_price })}
          </SizableText>
          {valueMoreComponent}
        </XStack>
        <XStack alignItems="center" gap="$1">
          {LimitMarketUpPercentages.map((percentage) => (
            <Badge
              key={percentage}
              bg="$bgApp"
              borderRadius="$2.5"
              borderWidth={1}
              borderCurve="continuous"
              borderColor={
                checkEqualMarketPrice(percentage)
                  ? '$borderActive'
                  : '$borderSubdued'
              }
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
        inputRate={limitPriceUseRate.inputRate}
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
