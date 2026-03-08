import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { TokenList } from '@onekeyhq/kit/src/views/FiatCrypto/components/TokenList';
import { useGetTokensList } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { openFiatCryptoUrl } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IFiatCryptoToken,
  IFiatCryptoType,
} from '@onekeyhq/shared/types/fiatCrypto';

import { NetworkContainer } from '../NetworkContainer';
import { useTokenDataContext } from '../TokenDataContainer';

type ISellOrBuyContentProps = {
  type: IFiatCryptoType;
  networkId: string;
  accountId?: string;
};

export const SellOrBuyContent = memo(
  ({ type, networkId, accountId }: ISellOrBuyContentProps) => {
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
      return result.toSorted((a, b) => {
        const num1 = a.fiatValue ?? '0';
        const num2 = b.fiatValue ?? '0';
        return BigNumber(num1).comparedTo(num2) * -1;
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
        if (type === 'buy') {
          defaultLogger.wallet.walletActions.buyStarted({
            tokenAddress: token.address,
            tokenSymbol: token.symbol,
            networkID: token.networkId,
          });
        }
        const { url } =
          await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
            networkId: token.networkId,
            tokenAddress: token.address,
            accountId: realAccountId,
            type,
          });
        if (!url) return;
        openFiatCryptoUrl(url);
      },
      [type],
    );

    const networkIds = useMemo(
      () => Array.from(new Set(fiatValueTokens.map((o) => o.networkId))),
      [fiatValueTokens],
    );

    return (
      <NetworkContainer networkIds={networkIds}>
        <TokenList
          items={fiatValueTokens}
          isLoading={isLoading}
          onPress={onPress}
        />
      </NetworkContainer>
    );
  },
);
SellOrBuyContent.displayName = 'SellOrBuyContent';
