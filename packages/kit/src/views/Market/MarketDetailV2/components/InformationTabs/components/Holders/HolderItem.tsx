import { memo } from 'react';

import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketTokenHolder } from '@onekeyhq/shared/types/marketV2';

import { AddressDisplay } from '../AddressDisplay';

import { useHoldersLayout } from './useHoldersLayout';

interface IHolderItemProps {
  item: IMarketTokenHolder & { marketCapPercentage?: string | null };
  index: number;
  networkId: string;
}

function HolderItemBase({ item, index, networkId }: IHolderItemProps) {
  const { layoutConfig } = useHoldersLayout();
  const [settingsPersistAtom] = useSettingsPersistAtom();

  return (
    <XStack h={40} px="$4" alignItems="center" gap="$3">
      {/* Rank */}
      <SizableText size="$bodyMd" color="$textSubdued" {...layoutConfig.rank}>
        #{index + 1}
      </SizableText>

      {/* Address with copy icon */}
      <AddressDisplay
        address={item.accountAddress}
        enableCopy
        enableOpenInBrowser
        networkId={networkId}
        style={layoutConfig.address}
      />

      {/* Market Cap Percentage */}
      <SizableText size="$bodyMd" color="$text" {...layoutConfig.percentage}>
        {item.marketCapPercentage ? `${item.marketCapPercentage}%` : '-'}
      </SizableText>

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
    </XStack>
  );
}

const HolderItem = memo(HolderItemBase);

export { HolderItem };
