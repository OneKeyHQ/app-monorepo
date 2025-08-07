import { useIntl } from 'react-intl';

import {
  Button,
  Spinner,
  Stack,
  View,
  useInModalDialog,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { MarketWatchListProviderMirrorV2 } from '../../../MarketWatchListProviderMirrorV2';

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
  const InModalDialog = useInModalDialog();

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
      InModalDialog.show({
        title: intl.formatMessage({ id: ETranslations.global_swap }),
        showFooter: false,
        showExitButton: true,
        renderContent: (
          <View p="$4">
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
        ),
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
