import { memo } from 'react';

import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketTokenHolder } from '@onekeyhq/shared/types/marketV2';

import { AddressDisplay } from '../../../AddressDisplay';
import { useHolderItemData } from '../../hooks/useHolderItemData';

import { useHoldersLayoutSmall } from './useHoldersLayoutSmall';

interface IHolderItemSmallProps {
  item: IMarketTokenHolder;
  index: number;
  networkId: string;
}

function HolderItemSmallBase({
  item,
  index,
  networkId,
}: IHolderItemSmallProps) {
  const { styles } = useHoldersLayoutSmall();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const { rank, displayPercentage, accountAddress, fiatValue } =
    useHolderItemData({ item, index });

  return (
    <XStack h={52} px="$4" alignItems="center" gap="$3">
      <XStack gap="$4" alignItems="center">
        {/* Rank */}
        <SizableText size="$bodyMd" color="$textSubdued">
          {rank}
        </SizableText>

        {/* Address */}
        <AddressDisplay
          style={{
            flexDirection: 'column',
            alignItems: 'flex-start',
            ...styles.address,
          }}
          address={accountAddress}
          enableCopy
          enableOpenInBrowser
          networkId={networkId}
        />
      </XStack>

      {/* Percentage */}
      <SizableText size="$bodyMd" color="$text" {...styles.percentage}>
        {displayPercentage}
      </SizableText>

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

const HolderItemSmall = memo(HolderItemSmallBase);

export { HolderItemSmall };
