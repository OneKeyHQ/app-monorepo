import { useEffect, useMemo } from 'react';

import { isEmpty } from 'lodash';

import { XStack, YStack, useIsFocusedTab } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { useBorrowContext } from '../BorrowProvider';
import { useBorrowMarkets } from '../hooks/useBorrowMarkets';
import { useBorrowReserves } from '../hooks/useBorrowReserves';
import { useEarnAccount } from '../hooks/useEarnAccount';

export const Markets = () => {
  const isFocused = useIsFocusedTab();
  const { markets } = useBorrowMarkets({ isActive: isFocused });
  const market = useMemo(() => markets?.[0], [markets]);
  const { setReserves, setMarket } = useBorrowContext();

  const { earnAccount } = useEarnAccount({
    networkId: market?.networkId,
  });
  const { fetchReserves } = useBorrowReserves();

  useEffect(() => {
    setMarket(market ?? null);
  }, [market, setMarket]);

  useEffect(() => {
    if (!isEmpty(market) && earnAccount) {
      void fetchReserves({
        provider: market?.provider,
        networkId: market?.networkId,
        marketAddress: market?.marketAddress,
        accountId: earnAccount?.account.id,
      }).then(setReserves);
    }
  }, [market, fetchReserves, setReserves, earnAccount]);

  return (
    <XStack mb="$4" h="$14" ai="center" gap="$3">
      <Token
        isNFT
        source={market?.logoURI}
        networkImageUri={market?.network.logoURI}
        size="md"
      />
      <YStack>
        <EarnText
          text={{ text: market?.network.name }}
          size="$bodySm"
          color="$textSubdued"
        />
        <EarnText
          text={{ text: market?.name }}
          size="$bodyLgMedium"
          color="$textText"
        />
      </YStack>
    </XStack>
  );
};
