import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Button, XStack, YStack } from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteFetchingAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';

import SwapFromAmountPercentage from '../../components/SwapFromAmountPercentage';
import SwapTokenAmountInput from '../../components/SwapTokenAmountInput';
import SwapTokenCurrencyValue from '../../components/SwapTokenCurrencyValue';
import SwapTokenSelectTrigger from '../../components/SwapTokenSelectTrigger';
import { swapFromAmountPercentageItems } from '../../config/SwapProvider.constants';
import { useSwapQuote } from '../../hooks/useSwapQuote';
import { useSwapNetworkList } from '../../hooks/useSwapTokens';
import { useSwapAccountNetworkSync } from '../../hooks/uswSwapAccount';

import SwapAccountAddressContainer from './SwapAccountAddressContainer';
import { SwapSelectTokenBalance } from './SwapSelectTokenBalance';

import type { ISwapFromAmountPercentageItem } from '../../types';

interface ISwapQuoteInputProps {
  onSelectToken: (type: 'from' | 'to') => void;
}

const SwapQuoteInput = ({ onSelectToken }: ISwapQuoteInputProps) => {
  const { fetchLoading } = useSwapNetworkList();
  const [fromInputAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [quoteFetching] = useSwapQuoteFetchingAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const { alternationToken } = useSwapActions().current;
  const [swapQuoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { activeAccount: activeAccount1 } = useActiveAccount({ num: 1 });

  useSwapQuote();

  const amountPrice = useMemo(() => {
    const fromTokenPriceBN = new BigNumber(fromToken?.price ?? 0);
    const toTokenPriceBN = new BigNumber(toToken?.price ?? 0);
    const fromTokenFiatValueBN = new BigNumber(
      fromInputAmount ?? 0,
    ).multipliedBy(fromTokenPriceBN);
    const toTokenFiatValueBN = new BigNumber(
      swapQuoteCurrentSelect?.toAmount ?? '0',
    ).multipliedBy(toTokenPriceBN);
    return {
      fromTokenFiatValue: fromTokenFiatValueBN.isNaN()
        ? '0'
        : fromTokenFiatValueBN.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(),
      toTokenFiatValue: toTokenFiatValueBN.isNaN()
        ? '0'
        : toTokenFiatValueBN.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(),
    };
  }, [
    fromInputAmount,
    fromToken?.price,
    swapQuoteCurrentSelect?.toAmount,
    toToken?.price,
  ]);

  const onSelectAmountPercentage = useCallback(
    (item: ISwapFromAmountPercentageItem) => {
      console.log('item-', item);
    },
    [],
  );

  useSwapAccountNetworkSync({ fromToken, toToken });

  return (
    <YStack>
      <YStack
        mx="$10"
        backgroundColor="$bgBackdropLight"
        borderTopLeftRadius="$4"
        borderTopRightRadius="$4"
        alignItems="center"
      >
        <XStack space="$4">
          <YStack space="$4">
            <SwapTokenAmountInput
              onInputChange={setFromInputAmount}
              inputValue={fromInputAmount}
            />
            <SwapTokenCurrencyValue
              value={amountPrice.fromTokenFiatValue}
              currency="$"
            />
          </YStack>
          <SwapTokenSelectTrigger
            loading={fetchLoading}
            currentToken={fromToken}
            onSelectTokenTrigger={() => {
              onSelectToken('from');
            }}
          />
        </XStack>
        {fromToken ? (
          <>
            <SwapAccountAddressContainer num={0} />
            <XStack>
              <SwapSelectTokenBalance
                accountAddress={activeAccount?.account?.address}
                accountNetworkId={activeAccount?.network?.id}
                accountXpub={(activeAccount?.account as IDBUtxoAccount)?.xpub}
                token={fromToken}
                type="from"
              />
              <SwapFromAmountPercentage
                selectItems={swapFromAmountPercentageItems}
                onSelectItem={onSelectAmountPercentage}
              />
            </XStack>
          </>
        ) : null}
      </YStack>
      <XStack justifyContent="center">
        <Button borderRadius="$4" onPress={alternationToken}>
          交换
        </Button>
      </XStack>
      <YStack
        mx="$10"
        backgroundColor="$bgBackdropLight"
        borderBottomLeftRadius="$4"
        borderBottomRightRadius="$4"
        alignItems="center"
      >
        <XStack space="$4">
          <YStack space="$4">
            <SwapTokenAmountInput
              loading={quoteFetching}
              onInputChange={() => {}}
              inputValue={swapQuoteCurrentSelect?.toAmount ?? ''}
              disabled
            />
            <SwapTokenCurrencyValue
              value={amountPrice.toTokenFiatValue}
              currency="$"
            />
          </YStack>
          <SwapTokenSelectTrigger
            loading={fetchLoading}
            currentToken={toToken}
            onSelectTokenTrigger={() => {
              onSelectToken('to');
            }}
          />
        </XStack>

        {toToken ? (
          <>
            <SwapAccountAddressContainer num={1} />
            <XStack>
              <SwapSelectTokenBalance
                accountAddress={activeAccount1?.account?.address}
                accountNetworkId={activeAccount1?.network?.id}
                accountXpub={(activeAccount1?.account as IDBUtxoAccount)?.xpub}
                token={toToken}
                type="to"
              />
            </XStack>
          </>
        ) : null}
      </YStack>
    </YStack>
  );
};

export default memo(SwapQuoteInput);
