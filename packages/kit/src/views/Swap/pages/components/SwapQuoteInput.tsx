import { memo } from 'react';

import { IconButton, XStack, YStack } from '@onekeyhq/components';
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
import { useSwapFromAccountNetworkSync } from '../../hooks/uswSwapAccount';
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
  useSwapQuote();
  useSwapFromAccountNetworkSync();
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
      />
    </YStack>
  );
};

export default memo(SwapQuoteInput);
