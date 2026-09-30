import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';

import { Page } from '@onekeyhq/components';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  EModalFiatCryptoRoutes,
  IModalFiatCryptoParamList,
} from '@onekeyhq/shared/src/routes';
import type { IFiatCryptoToken } from '@onekeyhq/shared/types/fiatCrypto';

import { TokenDataContainer } from '../../components/TokenDataContainer';
import { TokenList } from '../../components/TokenList';
import { TokenListMetaContainer } from '../../components/TokenListMeta';
import { useGetTokensListWithNetworks } from '../../hooks';

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

  const {
    result: { tokens, networksMap, mergeDeriveAssetsNetworkIds },
    isLoading,
  } = useGetTokensListWithNetworks({
    networkId,
    accountId,
    type: 'buy',
  });
  const { account } = useAccountData({ networkId, accountId });

  // Same eligibility as tryOpenHeadlessBuy's gate: a token missing the
  // server-delivered network slug can never quote, so it must not be offered.
  const items = useMemo(
    () => tokens.filter((o) => o.headlessSupported && o.onramperNetworkCode),
    [tokens],
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
      <Page.Header title="Select asset" />
      <Page.Body>
        <TokenDataContainer
          networkId={networkId}
          accountId={accountId}
          initialTokens={[]}
          initialMap={{}}
        >
          <TokenListMetaContainer
            networksMap={networksMap}
            mergeDeriveAssetsNetworkIds={mergeDeriveAssetsNetworkIds}
            account={account}
          >
            <TokenList
              items={items}
              type="buy"
              isLoading={isLoading}
              onPress={handlePress}
            />
          </TokenListMetaContainer>
        </TokenDataContainer>
      </Page.Body>
    </Page>
  );
}

export default HeadlessBuyTokenSelectorPage;
