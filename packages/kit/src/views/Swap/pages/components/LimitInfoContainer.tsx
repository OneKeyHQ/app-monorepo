import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  useSwapLimitPriceMarketPriceAtom,
  useSwapLimitPriceUseRateAtom,
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
  const [swapLimitPriceUseRate] = useSwapLimitPriceUseRateAtom();
  const [swapLimitPriceMarketPrice] = useSwapLimitPriceMarketPriceAtom();
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
    if (
      swapLimitPriceMarketPrice.rate &&
      swapLimitPriceUseRate.rate &&
      swapTypeSwitch === ESwapTabSwitchType.LIMIT
    ) {
      const useRateBN = new BigNumber(swapLimitPriceUseRate.rate);
      const marketPriceBN = new BigNumber(swapLimitPriceMarketPrice.rate);
      const rateDifference = useRateBN.minus(marketPriceBN).div(marketPriceBN);
      const rateDifferenceValue = rateDifference.multipliedBy(100).toFixed(2);
      if (new BigNumber(rateDifferenceValue).eq(0)) {
        return null;
      }
      let color = '$textSubdued';
      if (rateDifference.lt(0)) {
        color = '$textCritical';
      }
      if (rateDifference.gt(0)) {
        color = '$textSuccess';
      }
      return (
        <XStack alignItems="center">
          <SizableText size="$bodyMd" color={color}>
            (
          </SizableText>
          <Popover
            renderTrigger={
              <SizableText
                size="$bodyMd"
                color={color}
                textDecorationLine="underline"
                textDecorationStyle="dotted"
                textDecorationColor={color}
                cursor="pointer"
              >
                {`${rateDifferenceValue}%`}
              </SizableText>
            }
            title={intl.formatMessage({
              id: ETranslations.limit_price_trigger,
            })}
            renderContent={
              <Stack p="$3">
                <SizableText size="$bodyMd">
                  {intl.formatMessage(
                    {
                      id: rateDifference.gt(0)
                        ? ETranslations.limit_price_trigger_des_up
                        : ETranslations.limit_price_trigger_des_down,
                    },
                    {
                      num: `${rateDifferenceValue}%`,
                    },
                  )}
                </SizableText>
              </Stack>
            }
          />

          <SizableText size="$bodyMd" color={color}>
            )
          </SizableText>
        </XStack>
      );
    }
    return null;
  }, [
    swapLimitPriceMarketPrice.rate,
    swapLimitPriceUseRate.rate,
    swapTypeSwitch,
    intl,
  ]);

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
