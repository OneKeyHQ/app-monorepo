import type { PropsWithChildren } from 'react';
import { useCallback } from 'react';

import { CommonActions } from '@react-navigation/native';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';
import { TokenList } from '@onekeyhq/kit/src/views/FiatCrypto/components/TokenList';
import { useGetTokensList } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
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
  const { handleOpenWebSite } = useBrowserAction().current;
  const onPress = useCallback(
    async (token: IFiatCryptoToken) => {
      const { url } =
        await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
          networkId,
          tokenAddress: token.address,
          accountId,
          type,
        });

      handleOpenWebSite({
        webSite: { url, title },
        navigation: appNavigation,
      });
      if (platformEnv.isNative) {
        appNavigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [{ name: ETabRoutes.Home }],
          }),
        );
        appNavigation.switchTab(ETabRoutes.Discovery);
      }
    },
    [appNavigation, handleOpenWebSite, type, networkId, accountId, title],
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
