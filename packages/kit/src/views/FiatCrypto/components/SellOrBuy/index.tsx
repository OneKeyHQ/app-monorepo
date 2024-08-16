import type { PropsWithChildren } from 'react';
import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Page, Spinner, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';
import { TokenList } from '@onekeyhq/kit/src/views/FiatCrypto/components/TokenList';
import { useGetTokensList } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import type {
  EModalFiatCryptoRoutes,
  IModalFiatCryptoParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IFiatCryptoToken,
  IFiatCryptoType,
} from '@onekeyhq/shared/types/fiatCrypto';

import { NetworkContainer } from '../NetworkContainer';
import { useTokenDataContext } from '../TokenDataContainer';

type ISellOrBuyProps = {
  title: string;
  type: IFiatCryptoType;
  networkId: string;
  accountId?: string;
};

const SellOrBuy = ({ title, type, networkId, accountId }: ISellOrBuyProps) => {
  const appNavigation =
    useAppNavigation<
      IPageNavigationProp<
        IModalFiatCryptoParamList,
        EModalFiatCryptoRoutes.BuyModal
      >
    >();
  const { result: tokens, isLoading } = useGetTokensList({
    networkId,
    accountId,
    type,
  });
  const { getTokenFiatValue } = useTokenDataContext();
  const { account } = useAccountData({ networkId, accountId });

  const fiatValueTokens = useMemo(() => {
    if (!networkUtils.isAllNetwork({ networkId })) {
      return tokens;
    }
    let result = tokens.map((token) => ({
      ...token,
      fiatValue: getTokenFiatValue({
        networkId: token.networkId,
        tokenAddress: token.address.toLowerCase(),
      })?.fiatValue,
      balanceParsed: getTokenFiatValue({
        networkId: token.networkId,
        tokenAddress: token.address.toLowerCase(),
      })?.balanceParsed,
    }));
    if (type === 'sell') {
      result = result.filter(
        (o) => o.balanceParsed && Number(o.balanceParsed) !== 0,
      );
    }
    if (account && accountUtils.isOthersAccount({ accountId: account.id })) {
      result = result.filter((o) =>
        accountUtils.isAccountCompatibleWithNetwork({
          account,
          networkId: o.networkId,
        }),
      );
    }
    return result.sort((a, b) => {
      const num1 = a.fiatValue ?? '0';
      const num2 = b.fiatValue ?? '0';
      return BigNumber(num1).gt(num2) ? -1 : 1;
    });
  }, [tokens, getTokenFiatValue, networkId, type, account]);

  const onPress = useCallback(
    async ({
      token,
      realAccountId,
    }: {
      token: IFiatCryptoToken;
      realAccountId?: string;
    }) => {
      const { url } =
        await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
          networkId: token.networkId,
          tokenAddress: token.address,
          accountId: realAccountId,
          type,
        });
      openUrlExternal(url);
      appNavigation.popStack();
    },
    [appNavigation, type],
  );

  const networkIds = useMemo(
    () => Array.from(new Set(fiatValueTokens.map((o) => o.networkId))),
    [fiatValueTokens],
  );

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header title={title} />
      <Page.Body>
        <NetworkContainer networkIds={networkIds}>
          {isLoading ? (
            <Stack minHeight={300} justifyContent="center" alignItems="center">
              <Spinner size="large" />
            </Stack>
          ) : (
            <TokenList items={fiatValueTokens} onPress={onPress} />
          )}
        </NetworkContainer>
      </Page.Body>
    </Page>
  );
};

export default withBrowserProvider<PropsWithChildren<ISellOrBuyProps>>(
  SellOrBuy,
);
