import type { PropsWithChildren } from 'react';
import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';
import { TokenList } from '@onekeyhq/kit/src/views/FiatCrypto/components/TokenList';
import { useGetTokensList } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IFiatCryptoToken,
  IFiatCryptoType,
} from '@onekeyhq/shared/types/fiatCrypto';

import { useGetTokenFiatValue } from '../TokenDataContainer';

type ISellOrBuyProps = {
  title: string;
  type: IFiatCryptoType;
  networkId: string;
  accountId?: string;
};

const SellOrBuy = ({ title, type, networkId, accountId }: ISellOrBuyProps) => {
  const appNavigation = useAppNavigation();
  const { result: tokens } = useGetTokensList({
    networkId,
    accountId: networkUtils.isAllNetwork({ networkId }) ? undefined : accountId,
    type,
  });
  const getTokenFiatValue = useGetTokenFiatValue();

  const fiatValueTokens = useMemo(() => {
    if (!networkUtils.isAllNetwork({ networkId })) {
      return tokens;
    }
    const result = tokens.map((token) => ({
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
    return result.sort((a, b) => {
      const num1 = a.fiatValue ?? '0';
      const num2 = b.fiatValue ?? '0';
      return BigNumber(num1).gt(num2) ? -1 : 1;
    });
  }, [tokens, getTokenFiatValue, networkId]);
  const onPress = useCallback(
    async (token: IFiatCryptoToken) => {
      const { url } =
        await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
          networkId: token.networkId,
          tokenAddress: token.address,
          accountId,
          type,
        });
      openUrlExternal(url);
      appNavigation.popStack();
    },
    [appNavigation, type, accountId],
  );

  return (
    <Page>
      <Page.Header title={title} />
      <Page.Body>
        <TokenList items={fiatValueTokens} onPress={onPress} />
      </Page.Body>
    </Page>
  );
};

export default withBrowserProvider<PropsWithChildren<ISellOrBuyProps>>(
  SellOrBuy,
);
