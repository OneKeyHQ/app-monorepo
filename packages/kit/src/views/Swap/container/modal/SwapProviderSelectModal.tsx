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
  SizableText,
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
    (item: IFetchQuoteResult) => {
      if (!item.isBest) {
        const firstItem = swapQuoteList[0];
        const firstPrice = new BigNumber(firstItem.toAmount);
        const currentPrice = new BigNumber(item.toAmount);
        const spread = firstPrice.minus(currentPrice).dividedBy(firstPrice);
        return `${spread.multipliedBy(100).toFixed(2)}%`;
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
            <SizableText>{item.info.providerName}</SizableText>
            {isAllowance && <Icon name="LockSolid" />}
          </XStack>
          <SizableText>{`${item.toAmount} ${
            toToken?.symbol ?? ''
          }`}</SizableText>
          <Badge
            badgeType={index === 0 ? 'success' : 'critical'}
            badgeSize="sm"
          >
            {providerPriceSpread(item)}
          </Badge>
        </ListItem>
      );
    },
    [onSelectQuote, providerPriceSpread, toToken?.symbol],
  );
  const headerComponent = useMemo(
    () => (
      <XStack justifyContent="space-around">
        <SizableText>Provider</SizableText>
        <SizableText>Recieved</SizableText>
        <SizableText>Difference</SizableText>
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
