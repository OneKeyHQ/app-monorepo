import { useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Button,
  EInPageDialogType,
  Spinner,
  Stack,
  View,
  useInPageDialog,
  useIsModalPage,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useSwapProJumpTokenAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/swap';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { MarketWatchListProviderMirrorV2 } from '../../../MarketWatchListProviderMirrorV2';

import { SwapPanelWrap } from './SwapPanelWrap';

export function SwapPanel({
  swapToken,
  disableTrade,
}: {
  swapToken: ISwapToken;
  disableTrade?: boolean;
}) {
  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();
  const isModalPage = useIsModalPage();
  const inPageDialog = useInPageDialog(
    isModalPage ? EInPageDialogType.inModalPage : EInPageDialogType.inTabPages,
  );
  const dialogRef = useRef<IDialogInstance>(null);
  const [, setSwapProJumpTokenAtom] = useSwapProJumpTokenAtom();
  if (!swapToken) {
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
    if (swapToken) {
      dialogRef.current = inPageDialog.show({
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

  if (platformEnv.isNative) {
    if (disableTrade) {
      return null;
    }
    return (
      <View p="$3">
        <Button
          size="large"
          variant="primary"
          onPress={() => {
            setSwapProJumpTokenAtom({ token: swapToken });
            navigation.pop();
            navigation.switchTab(ETabRoutes.Swap);
          }}
        >
          {intl.formatMessage({ id: ETranslations.dexmarket_details_trade })}
        </Button>
      </View>
    );
  }

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
