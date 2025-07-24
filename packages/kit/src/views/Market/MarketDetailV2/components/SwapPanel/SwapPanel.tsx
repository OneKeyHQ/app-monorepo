import { useIntl } from 'react-intl';

import { Button, Spinner, Stack, View, useMedia } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { MarketWatchListProviderMirrorV2 } from '../../../MarketWatchListProviderMirrorV2';
import { EModalMarketRoutes } from '../../../router';

import { SwapPanelWrap } from './SwapPanelWrap';

export function SwapPanel({
  networkId,
  tokenAddress,
}: {
  networkId?: string;
  tokenAddress?: string;
}) {
  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();

  if (!networkId || !tokenAddress) {
    return (
      <Stack
        minHeight={400}
        justifyContent="center"
        alignItems="center"
        width="full"
      >
        <Spinner />
      </Stack>
    );
  }

  const showSwapDialog = () => {
    if (networkId && tokenAddress) {
      navigation.pushModal(EModalRoutes.MarketModal, {
        screen: EModalMarketRoutes.MarketSwap,
        params: {
          networkId,
          tokenAddress,
        },
      });
    }
  };

  if (media.lg) {
    return (
      <View p="$3">
        <Button size="large" variant="primary" onPress={() => showSwapDialog()}>
          {intl.formatMessage({ id: ETranslations.dexmarket_details_trade })}
        </Button>
      </View>
    );
  }

  return (
    <View>
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.home,
          sceneUrl: '',
        }}
        enabledNum={[0]}
      >
        <MarketWatchListProviderMirrorV2
          storeName={EJotaiContextStoreNames.marketWatchListV2}
        >
          <SwapPanelWrap />
        </MarketWatchListProviderMirrorV2>
      </AccountSelectorProviderMirror>
    </View>
  );
}
