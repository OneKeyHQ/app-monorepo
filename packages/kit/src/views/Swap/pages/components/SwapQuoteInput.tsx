import { memo } from 'react';

import { IconButton, YStack } from '@onekeyhq/components';
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

import { useSwapFromAccountNetworkSync } from '../../hooks/useSwapAccount';
import { useSwapApproving } from '../../hooks/useSwapAproving';
import { useSwapQuote } from '../../hooks/useSwapQuote';
import { useSwapNetworkList } from '../../hooks/useSwapTokens';
import { validateAmountInput } from '../../utils/utils';

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
        selectTokenLoading={fetchLoading}
        onAmountChange={(value) => {
          if (validateAmountInput(value)) {
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
      <YStack pt="$3.5">
        <IconButton
          alignSelf="flex-end"
          icon="SwitchVerOutline"
          size="small"
          onPress={alternationToken}
          mb="$-3"
        />
        <SwapInputContainer
          token={toToken}
          inputLoading={quoteFetching}
          selectTokenLoading={fetchLoading}
          direction={ESwapDirectionType.TO}
          amountValue={swapQuoteCurrentSelect?.toAmount ?? ''}
          onSelectToken={onSelectToken}
          balance={toTokenBalance}
        />
      </YStack>
    </YStack>
  );
};

export default memo(SwapQuoteInput);
