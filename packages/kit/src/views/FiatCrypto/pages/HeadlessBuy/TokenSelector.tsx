import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  EModalFiatCryptoRoutes,
  IModalFiatCryptoParamList,
} from '@onekeyhq/shared/src/routes';
import type { IFiatCryptoToken } from '@onekeyhq/shared/types/fiatCrypto';

import { NetworkContainer } from '../../components/NetworkContainer';
import { TokenDataContainer } from '../../components/TokenDataContainer';
import { TokenList } from '../../components/TokenList';
import { useGetTokensList } from '../../hooks';

import type { RouteProp } from '@react-navigation/core';

// Destination-crypto picker for the Headless buy screen: the buy token list of
// the entry network, narrowed to tokens the native Apple Pay flow can actually
// purchase. Same-network only, so the receiving account never changes chain.
function HeadlessBuyTokenSelectorPage() {
  const route =
    useRoute<
      RouteProp<
        IModalFiatCryptoParamList,
        EModalFiatCryptoRoutes.HeadlessBuyTokenSelector
      >
    >();
  const { networkId, accountId, onSelected } = route.params;
  const navigation = useAppNavigation();

  const { result: tokens, isLoading } = useGetTokensList({
    networkId,
    accountId,
    type: 'buy',
  });

  const items = useMemo(
    () => tokens.filter((o) => o.headlessSupported),
    [tokens],
  );

  const networkIds = useMemo(
    () => Array.from(new Set(items.map((o) => o.networkId))),
    [items],
  );

  const handlePress = useCallback(
    ({
      token,
      realAccountId,
    }: {
      token: IFiatCryptoToken;
      realAccountId?: string;
    }) => {
      onSelected({ token, realAccountId });
      navigation.pop();
    },
    [onSelected, navigation],
  );

  return (
    <Page>
      <Page.Header title="選擇資產" />
      <Page.Body>
        <TokenDataContainer
          networkId={networkId}
          accountId={accountId}
          initialTokens={[]}
          initialMap={{}}
        >
          <NetworkContainer networkIds={networkIds}>
            <TokenList
              items={items}
              type="buy"
              isLoading={isLoading}
              onPress={handlePress}
            />
          </NetworkContainer>
        </TokenDataContainer>
      </Page.Body>
    </Page>
  );
}

export default HeadlessBuyTokenSelectorPage;
