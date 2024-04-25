import type { PropsWithChildren } from 'react';
import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';
import { TokenList } from '@onekeyhq/kit/src/views/FiatCrypto/components/TokenList';
import { useGetTokensList } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IFiatCryptoToken,
  IFiatCryptoType,
} from '@onekeyhq/shared/types/fiatCrypto';

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
    accountId: type === 'sell' ? accountId : undefined,
    type,
  });
  const onPress = useCallback(
    async (token: IFiatCryptoToken) => {
      const { url } =
        await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
          networkId,
          tokenAddress: token.address,
          accountId,
          type,
        });
      openUrlExternal(url);
      appNavigation.popStack();
    },
    [appNavigation, type, networkId, accountId],
  );

  return (
    <Page>
      <Page.Header title={title} />
      <Page.Body>
        <TokenList items={tokens} onPress={onPress} />
      </Page.Body>
    </Page>
  );
};

export default withBrowserProvider<PropsWithChildren<ISellOrBuyProps>>(
  SellOrBuy,
);
