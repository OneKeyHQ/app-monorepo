import type { PropsWithChildren } from 'react';
import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Page, Spinner, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';
import { TokenList } from '@onekeyhq/kit/src/views/FiatCrypto/components/TokenList';
import { useGetTokensList } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IFiatCryptoToken,
  IFiatCryptoType,
} from '@onekeyhq/shared/types/fiatCrypto';

import { NetworkContainer } from '../NetworkContainer';
import { useGetTokenFiatValue } from '../TokenDataContainer';

type ISellOrBuyProps = {
  title: string;
  type: IFiatCryptoType;
  networkId: string;
  accountId?: string;
};

const SellOrBuy = ({ title, type, networkId, accountId }: ISellOrBuyProps) => {
  const appNavigation = useAppNavigation();
  const { result: tokens, isLoading } = useGetTokensList({
    networkId,
    accountId: networkUtils.isAllNetwork({ networkId }) ? undefined : accountId,
    type,
  });
  const getTokenFiatValue = useGetTokenFiatValue();
  const { account } = useAccountData({ networkId, accountId });

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
      let realAccountId = accountId;
      if (networkUtils.isAllNetwork({ networkId })) {
        // do all network
        const networkAccounts =
          await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
            {
              networkIds: [token.networkId ?? ''],
              indexedAccountId: account?.indexedAccountId ?? '',
            },
          );
        const networkAccount = networkAccounts[0];
        if (networkAccount.account) {
          realAccountId = networkAccount.account.id;
        } else if (account) {
          const walletId = accountUtils.getWalletIdFromAccountId({
            accountId: account.id,
          });
          try {
            const resp =
              await backgroundApiProxy.serviceAccount.addHDOrHWAccounts({
                walletId,
                indexedAccountId: account?.indexedAccountId,
                deriveType: 'default',
                networkId: token.networkId,
              });
            realAccountId = resp?.accounts[0].id;
          } catch {
            console.error('failed to create address');
          }
        }
      }
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
    [appNavigation, type, accountId, networkId, account],
  );

  const networkIds = useMemo(
    () => Array.from(new Set(fiatValueTokens.map((o) => o.networkId))),
    [fiatValueTokens],
  );

  return (
    <Page>
      <Page.Header title={title} />
      <Page.Body>
        <NetworkContainer networkIds={networkIds}>
          {isLoading ? (
            <Stack minHeight={120} justifyContent="center" alignItems="center">
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
