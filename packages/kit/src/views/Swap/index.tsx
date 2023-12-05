import { memo, useCallback, useMemo, useState } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Input,
  Page,
  Skeleton,
  Text,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type {
  IFetchQuoteResponse,
  IFetchQuoteResult,
} from '@onekeyhq/kit-bg/src/services/ServiceSwap';
import { CrossChainSwapProviders } from '@onekeyhq/kit-bg/src/services/ServiceSwap';
import { useSwapAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { EModalRoutes } from '../../routes/Root/Modal/Routes';

import { QuoteResult } from './Components/QuoteResult';
import { EModalSwapRoutes, type IModalSwapParamList } from './types';
import { validateInput } from './utils/utils';

const Swap = () => {
  console.log('swap');
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [
    { fromNetwork, toNetwork, toToken, fromToken, isOnlySupportSingleChain },
  ] = useSwapAtom();
  const [fromInputAmount, setFromInputAmount] = useState('');
  const [quoteFetching, setQuoteFetching] = useState(false);
  const [quotesRes, setQuotesRes] = useState<IFetchQuoteResponse[]>([]);
  const [selectQuote, setSelectQuote] = useState<IFetchQuoteResult | null>(
    null,
  );

  const onSelectNetwork = useCallback(
    (type: 'from' | 'to') => {
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapNetworkSelect,
        params: { type },
      });
    },
    [navigation],
  );
  const onSelectToken = useCallback(
    (type: 'from' | 'to') => {
      if (!fromNetwork) {
        Toast.error({ title: 'please select network' });
        return;
      }
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapTokenSelect,
        params: { type },
      });
    },
    [fromNetwork, navigation],
  );

  const onInputChange = useCallback(
    async (text: string) => {
      console.log('onInputChange', text);
      setFromInputAmount(text);
      const inputAmountNumber = Number(text);
      if (
        Number.isNaN(inputAmountNumber) ||
        inputAmountNumber === 0 ||
        text === ''
      ) {
        if (quoteFetching)
          await backgroundApiProxy.serviceSwap.cancelFetchQuotes();
        setQuoteFetching(false);
        setSelectQuote(null);
        return;
      }

      if (fromToken && toToken) {
        try {
          setQuoteFetching(true);
          const res = await backgroundApiProxy.serviceSwap.fetchQuotes({
            fromToken,
            toToken,
            fromTokenAmount: text,
          });
          if (res && res?.length > 0) {
            setQuotesRes(res);
            setSelectQuote(res[0]?.quoteResult);
          }
          setQuoteFetching(false);
        } catch (e: any) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (e?.message !== 'cancel') {
            setQuoteFetching(false);
          }
        }
      }
    },
    [fromToken, quoteFetching, toToken],
  );

  const onSwap = useCallback(async () => {}, []);
  return (
    <Page>
      <Page.Body space="$4">
        <Text>Swap</Text>
        <YStack space="$8">
          <XStack justifyContent="space-around" alignItems="center">
            <YStack space="$4">
              <Button
                variant="primary"
                onPress={() => {
                  onSelectNetwork('from');
                }}
              >
                {fromNetwork?.networkId ?? 'Select Network'}
              </Button>
              <Button
                variant="primary"
                onPress={() => {
                  onSelectToken('from');
                }}
              >
                {fromToken?.symbol ?? 'Select Tokens'}
              </Button>
            </YStack>
            <Input
              value={fromInputAmount}
              placeholder="0.0"
              onChangeText={(text) => {
                if (validateInput(text)) {
                  void onInputChange(text);
                }
              }}
            />
          </XStack>
          <XStack justifyContent="space-around" alignItems="center">
            <YStack space="$4">
              <Button
                disabled={isOnlySupportSingleChain}
                variant="primary"
                onPress={() => {
                  onSelectNetwork('to');
                }}
              >
                {toNetwork?.networkId ?? 'Select Network'}
              </Button>
              <Button
                variant="primary"
                onPress={() => {
                  onSelectToken('to');
                }}
              >
                {toToken?.symbol ?? 'Select Tokens'}
              </Button>
            </YStack>
            {quoteFetching ? (
              <Skeleton width={200} />
            ) : (
              <Input
                placeholder="0.0"
                disabled
                value={selectQuote?.finialAmount ?? ''}
              />
            )}
          </XStack>
          <Button
            marginHorizontal="$12"
            variant="primary"
            disabled={selectQuote === null}
            onPress={onSwap}
          >
            Swap
          </Button>
          {quotesRes.map((quoteRes) => (
            <QuoteResult
              quoteResponse={quoteRes}
              onSelectQuote={(quote) => {
                setSelectQuote(quote.quoteResult);
              }}
            />
          ))}
        </YStack>
      </Page.Body>
    </Page>
  );
};

export default memo(Swap);
