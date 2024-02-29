import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { IconButton, XStack, YStack } from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteFetchingAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapSelectedToTokenBalanceAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapApproving } from '../../hooks/useSwapAproving';
import { useSwapQuote } from '../../hooks/useSwapQuote';
import { useSwapNetworkList } from '../../hooks/useSwapTokens';
import { useSwapAccountNetworkSync } from '../../hooks/uswSwapAccount';
import { validateInput } from '../../utils/utils';

import SwapInputContainer from './SwapInputContainer';

interface ISwapQuoteInputProps {
  onSelectToken: (type: ESwapDirectionType) => void;
}

const SwapQuoteInput = ({ onSelectToken }: ISwapQuoteInputProps) => {
  const { fetchLoading } = useSwapNetworkList();
  const [fromInputAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [quoteFetching] = useSwapQuoteFetchingAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const { alternationToken } = useSwapActions().current;
  const [swapQuoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  const [fromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const [toTokenBalance] = useSwapSelectedToTokenBalanceAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  useSwapQuote();
  useSwapAccountNetworkSync();
  useSwapApproving();

  return (
    <YStack>
      <SwapInputContainer
        token={fromToken}
        direction={ESwapDirectionType.FROM}
        onAmountChange={(value) => {
          if (validateInput(value)) {
            setFromInputAmount(value);
          }
        }}
        amountValue={fromInputAmount}
        onBalanceMaxPress={() => {
          setFromInputAmount(fromTokenBalance);
        }}
        onSelectToken={onSelectToken}
        balance={fromTokenBalance}
        address={activeAccount.account?.address}
      />
      <XStack justifyContent="flex-end" mr="$10" my="$2">
        <IconButton icon="SwitchVerOutline" onPress={alternationToken} />
      </XStack>
      <SwapInputContainer
        token={toToken}
        direction={ESwapDirectionType.TO}
        amountValue={swapQuoteCurrentSelect?.toAmount ?? ''}
        onSelectToken={onSelectToken}
        balance={toTokenBalance}
        address={activeAccount.account?.address}
      />
    </YStack>
  );
};

export default memo(SwapQuoteInput);
