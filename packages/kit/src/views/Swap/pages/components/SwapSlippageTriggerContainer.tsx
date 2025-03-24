import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { Badge, Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  mevSwapNetworks,
  swapSlippageDecimal,
  swapSlippageWillAheadMinValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapSlippageSegmentKey,
} from '@onekeyhq/shared/types/swap/types';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import { useSwapAddressInfo } from '../../hooks/useSwapAccount';

interface ISwapSlippageTriggerContainerProps {
  isLoading: boolean;
  slippageItem: ISwapSlippageSegmentItem;
  onPress: () => void;
}

const SwapSlippageTriggerContainer = ({
  isLoading,
  onPress,
  slippageItem,
}: ISwapSlippageTriggerContainerProps) => {
  const intl = useIntl();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const displaySlippage = useMemo(
    () =>
      new BigNumber(slippageItem.value)
        .decimalPlaces(swapSlippageDecimal, BigNumber.ROUND_DOWN)
        .toFixed(),
    [slippageItem.value],
  );
  const slippageDisplayValue = useMemo(
    () =>
      intl.formatMessage(
        {
          id:
            slippageItem.key === ESwapSlippageSegmentKey.AUTO
              ? ETranslations.swap_page_provider_slippage_auto
              : ETranslations.swap_page_provider_custom,
        },
        { number: displaySlippage },
      ),
    [displaySlippage, intl, slippageItem.key],
  );

  const debounceOnPress = useDebouncedCallback(onPress, 350);

  const valueComponent = useMemo(
    () => (
      <XStack gap="$1" alignItems="center">
        {!accountUtils.isExternalWallet({
          walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
        }) &&
        mevSwapNetworks.includes(
          swapFromAddressInfo.accountInfo?.network?.id ?? '',
        ) ? (
          <Badge gap="$1" badgeSize="sm" badgeType="success" h="$5">
            <Icon
              name="ShieldCheckDoneOutline"
              color="$textSuccess"
              size="$4"
            />
            <Badge.Text size="$bodySmMedium" color="$textSuccess">
              MEV
            </Badge.Text>
          </Badge>
        ) : null}
        <SizableText
          size="$bodyMdMedium"
          color={
            slippageItem.value > swapSlippageWillAheadMinValue
              ? '$textCaution'
              : '$text'
          }
        >
          {slippageDisplayValue}
        </SizableText>
      </XStack>
    ),
    [
      slippageDisplayValue,
      slippageItem.value,
      swapFromAddressInfo.accountInfo?.network?.id,
      swapFromAddressInfo.accountInfo?.wallet?.id,
    ],
  );
  return (
    <SwapCommonInfoItem
      title={intl.formatMessage({
        id: ETranslations.swap_page_provider_slippage_tolerance,
      })}
      isLoading={isLoading}
      onPress={debounceOnPress}
      questionMarkContent={
        <SizableText
          p="$5"
          $gtMd={{
            size: '$bodyMd',
          }}
        >
          {intl.formatMessage({
            id: ETranslations.slippage_tolerance_popover,
          })}
        </SizableText>
      }
      valueComponent={valueComponent}
    />
  );
};

export default memo(SwapSlippageTriggerContainer);
