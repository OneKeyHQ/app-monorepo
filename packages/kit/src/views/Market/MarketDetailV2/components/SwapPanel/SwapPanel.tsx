import { useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
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
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
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
  const inModalDialog = useInModalDialog();
  const dialogRef = useRef<IDialogInstance>(null);

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
      dialogRef.current = inModalDialog.show({
        onClose: () => {
          appEventBus.emit(
            EAppEventBusNames.SwapPanelDismissKeyboard,
            undefined,
          );
          void dismissKeyboardWithDelay(100);
        },
        title: intl.formatMessage({ id: ETranslations.global_swap }),
        showFooter: false,
        showExitButton: true,
        renderContent: (
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
                <SwapPanelWrap
                  onCloseDialog={() => dialogRef.current?.close()}
                />
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
