import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Badge,
  Icon,
  Image,
  ListItem,
  ListView,
  Page,
  Text,
  XStack,
} from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import {
  useSwapManualSelectQuoteProvidersAtom,
  useSwapQuoteListAtom,
  useSwapSelectToTokenAtom,
} from '../../../../states/jotai/contexts/swap';
import { withSwapProvider } from '../WithSwapProvider';

import type { IModalSwapParamList } from '../../router/Routers';
import type { IFetchQuoteResult } from '../../types';

const SwapProviderSelectModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const [swapQuoteList] = useSwapQuoteListAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [, setSwapManualSelect] = useSwapManualSelectQuoteProvidersAtom();

  const onSelectQuote = useCallback(
    (item: IFetchQuoteResult) => {
      setSwapManualSelect(item);
      navigation.pop();
    },
    [navigation, setSwapManualSelect],
  );

  const providerPriceSpread = useCallback(
    (item: IFetchQuoteResult, index: number) => {
      if (index !== 0) {
        const firstItem = swapQuoteList[0];
        const firstPrice = new BigNumber(firstItem.toAmount);
        const currentPrice = new BigNumber(item.toAmount);
        const spread = currentPrice.minus(firstPrice).multipliedBy(firstPrice);
        return `${spread.div(100).toFixed(2)}%`;
      }
      return `👍 Best`;
    },
    [swapQuoteList],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: IFetchQuoteResult; index: number }) => {
      const isAllowance = !!item.allowanceResult;
      return (
        <ListItem
          justifyContent="space-around"
          onPress={() => {
            onSelectQuote(item);
          }}
        >
          <XStack>
            <Image
              source={{ uri: item.info.providerLogo }}
              resizeMode="center"
              w="$10"
              h="$10"
            />
            <Text>{item.info.providerName}</Text>
            {isAllowance && <Icon name="LockSolid" />}
          </XStack>
          <Text>{`${item.toAmount} ${toToken?.symbol ?? ''}`}</Text>
          <Badge type={index === 0 ? 'success' : 'critical'} size="sm">
            {providerPriceSpread(item, index)}
          </Badge>
        </ListItem>
      );
    },
    [onSelectQuote, providerPriceSpread, toToken?.symbol],
  );
  const headerComponent = useMemo(
    () => (
      <XStack justifyContent="space-around">
        <Text>Provider</Text>
        <Text>Recieved</Text>
        <Text>Difference</Text>
      </XStack>
    ),
    [],
  );
  return (
    <Page>
      <ListView
        estimatedItemSize="$10"
        renderItem={renderItem}
        data={swapQuoteList}
        ListHeaderComponent={headerComponent}
      />
    </Page>
  );
};

export default withSwapProvider(SwapProviderSelectModal);
