import { memo } from 'react';

import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketTokenHolder } from '@onekeyhq/shared/types/marketV2';

import { AddressDisplay } from '../../../AddressDisplay';
import { useHolderItemData } from '../../hooks/useHolderItemData';

import { useHoldersLayoutNormal } from './useHoldersLayoutNormal';

interface IHolderItemNormalProps {
  item: IMarketTokenHolder;
  index: number;
  networkId: string;
}

function HolderItemNormalBase({
  item,
  index,
  networkId,
}: IHolderItemNormalProps) {
  const { styles } = useHoldersLayoutNormal();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const { rank, displayPercentage, accountAddress, amount, fiatValue } =
    useHolderItemData({ item, index });

  return (
    <XStack h={40} px="$4" alignItems="center">
      {/* Rank */}
      <SizableText size="$bodyMd" color="$textSubdued" {...styles.rank}>
        #{rank}
      </SizableText>

      {/* Address with copy icon */}
      <AddressDisplay
        address={accountAddress}
        enableCopy
        enableOpenInBrowser
        networkId={networkId}
        style={styles.address}
      />

      {/* Market Cap Percentage */}
      <SizableText size="$bodyMd" color="$text" {...styles.percentage}>
        {displayPercentage}
      </SizableText>

      {/* Amount */}
      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        {...styles.amount}
        formatter="marketCap"
      >
        {amount}
      </NumberSizeableText>

      {/* Fiat Value */}
      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        {...styles.value}
        formatter="marketCap"
        formatterOptions={{
          currency: settingsPersistAtom.currencyInfo.symbol,
        }}
      >
        {fiatValue}
      </NumberSizeableText>
    </XStack>
  );
}

const HolderItemNormal = memo(HolderItemNormalBase);

export { HolderItemNormal };
