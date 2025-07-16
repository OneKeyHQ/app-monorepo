import { memo, useCallback, useMemo } from 'react';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IMarketTokenHolder } from '@onekeyhq/shared/types/marketV2';

import BigNumber from 'bignumber.js';

import { useTokenDetail } from '../../../../hooks/useTokenDetail';
import { useHoldersLayout } from './useHoldersLayout';

interface IHolderItemProps {
  item: IMarketTokenHolder;
  index: number;
}

function HolderItemBase({ item, index }: IHolderItemProps) {
  const { copyText } = useClipboard();
  const { layoutConfig } = useHoldersLayout();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const { tokenDetail, isReady } = useTokenDetail();

  const handleCopyAddress = useCallback(() => {
    copyText(item.accountAddress);
  }, [copyText, item.accountAddress]);

  const marketCapPercentage = useMemo(() => {
    if (!isReady || !tokenDetail?.marketCap || !item.fiatValue) {
      return null;
    }

    try {
      const holderValue = new BigNumber(item.fiatValue);
      const totalMarketCap = new BigNumber(tokenDetail.marketCap);
      
      if (totalMarketCap.isLessThanOrEqualTo(0)) {
        return null;
      }

      const percentage = holderValue
        .dividedBy(totalMarketCap)
        .multipliedBy(100);
      return percentage.toFixed(2);
    } catch (error) {
      return null;
    }
  }, [isReady, tokenDetail?.marketCap, item.fiatValue]);

  return (
    <XStack py="$3" px="$4" alignItems="center" gap="$3">
      {/* Rank */}
      <SizableText size="$bodyMd" color="$textSubdued" {...layoutConfig.rank}>
        #{index + 1}
      </SizableText>

      {/* Address with copy icon */}
      <XStack
        onPress={handleCopyAddress}
        cursor="pointer"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        borderRadius="$2"
        px="$1"
        py="$1"
        alignItems="center"
        gap="$1"
        {...layoutConfig.address}
        mx="$-1"
      >
        <SizableText
          fontFamily="$monoRegular"
          size="$bodyMd"
          color="$text"
          numberOfLines={1}
          flexShrink={1}
        >
          {accountUtils.shortenAddress({
            address: item.accountAddress,
            leadingLength: 6,
            trailingLength: 4,
          })}
        </SizableText>
        <Icon name="Copy2Outline" size="$4" color="$iconSubdued" />
      </XStack>

      {/* Amount */}
      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        {...layoutConfig.amount}
        formatter="marketCap"
      >
        {item.amount}
      </NumberSizeableText>

      {/* Fiat Value */}
      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        {...layoutConfig.value}
        formatter="marketCap"
        formatterOptions={{
          currency: settingsPersistAtom.currencyInfo.symbol,
        }}
      >
        {item.fiatValue}
      </NumberSizeableText>

      {/* Market Cap Percentage */}
      <SizableText size="$bodyMd" color="$text" {...layoutConfig.percentage}>
        {marketCapPercentage ? `${marketCapPercentage}%` : '-'}
      </SizableText>
    </XStack>
  );
}

const HolderItem = memo(HolderItemBase);

export { HolderItem };
