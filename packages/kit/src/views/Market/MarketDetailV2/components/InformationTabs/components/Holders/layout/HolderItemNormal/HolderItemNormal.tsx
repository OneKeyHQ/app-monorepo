import { memo } from 'react';

import {
  NumberSizeableText,
  SizableText,
  TABULAR_NUMS,
  XStack,
} from '@onekeyhq/components';
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
  const { rank, displayPercentage, accountAddress, amount, fiatValue } =
    useHolderItemData({ item, index });

  return (
    <XStack
      h={40}
      pl="$5"
      pr="$3"
      alignItems="center"
      cursor="default"
      {...(index % 2 === 1 && { backgroundColor: '$bgSubdued' })}
      hoverStyle={{ backgroundColor: '$bgHover' }}
    >
      {/* Rank */}
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        {...styles.rank}
        fontVariant={TABULAR_NUMS}
      >
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
      <SizableText
        size="$bodyMd"
        color="$text"
        {...styles.percentage}
        fontVariant={TABULAR_NUMS}
      >
        {displayPercentage}
      </SizableText>

      {/* Amount */}
      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        {...styles.amount}
        formatter="marketCap"
        fontVariant={TABULAR_NUMS}
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
          currency: '$',
        }}
        fontVariant={TABULAR_NUMS}
      >
        {fiatValue}
      </NumberSizeableText>
    </XStack>
  );
}

const HolderItemNormal = memo(HolderItemNormalBase);

export { HolderItemNormal };
