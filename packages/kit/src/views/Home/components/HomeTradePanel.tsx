import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  EPageType,
  ScrollView,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TokenSwapHandoffContext } from '@onekeyhq/kit/src/components/TokenListView/TokenListViewContext';
import type { ITokenSwapHandoffParams } from '@onekeyhq/kit/src/components/TokenListView/TokenListViewContext';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EJotaiContextStoreNames,
  useSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { buildSwapSelectedTokensColdStartAccountKey } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { ISwapInitParams } from '@onekeyhq/shared/types/swap/types';

import { HOME_TRADE_COLUMN_WIDTH } from '../types';

type IEmbeddedSwapProps = {
  storeName?: EJotaiContextStoreNames;
  pageType?: EPageType.modal;
  singleSwapBridgeHeader?: boolean;
  singleSwapBridgeTitle?: string;
  swapInitParams?: ISwapInitParams;
  reviewContextKey?: string;
};

function TradePanelLoading() {
  return (
    <YStack width="100%" gap="$4">
      <Skeleton h="$32" w="100%" borderRadius="$4" />
      <Skeleton h="$32" w="100%" borderRadius="$4" />
      <Skeleton h="$12" w="100%" borderRadius="$full" />
    </YStack>
  );
}

// The Market page's embedded form; loaded after the home's first paint.
const LazyEmbeddedSwap = LazyLoad<IEmbeddedSwapProps>(
  () =>
    import(
      /* webpackChunkName: "home-trade-panel" */ '../../Swap/pages/components/SwapMainLand'
    ).then((module) => ({ default: module.default })),
  undefined,
  <TradePanelLoading />,
);

type ITradeHandoff = { params: ITokenSwapHandoffParams; at: number };

function HomeTradePanel({
  handoff,
  importAccountKey,
}: {
  handoff?: ITradeHandoff;
  importAccountKey?: string;
}) {
  const intl = useIntl();
  const swapInitParams = useMemo<ISwapInitParams>(
    () =>
      handoff?.params ?? {
        importAccountKey,
        swapTabSwitchType: ESwapTabSwitchType.SWAP,
        swapSource: ESwapSource.WALLET_HOME_TRADE_PANEL,
      },
    [handoff, importAccountKey],
  );
  // A row's hand-off, or another home account, starts the form over.
  const formKey = `${importAccountKey}:${handoff?.at ?? 0}`;
  return (
    <YStack
      testID="home-trade-column"
      width={HOME_TRADE_COLUMN_WIDTH}
      flexShrink={0}
      // A full-height pane, ruled off like the Perps trading column.
      borderLeftWidth="$px"
      borderLeftColor="$borderSubdued"
    >
      <ScrollView flex={1}>
        {/* The form pads its sides and bottom 20 itself; 16 on top sets its
            title row level with the account row beside it. */}
        <YStack pt="$4">
          <AccountSelectorProviderMirror
            config={{ sceneName: EAccountSelectorSceneName.swap }}
            enabledNum={[0, 1]}
          >
            <Stack key={formKey} width="100%">
              <LazyEmbeddedSwap
                storeName={EJotaiContextStoreNames.swapHomeToken}
                pageType={EPageType.modal}
                singleSwapBridgeHeader
                singleSwapBridgeTitle={intl.formatMessage({
                  id: ETranslations.global_swap,
                })}
                swapInitParams={swapInitParams}
                reviewContextKey={`home-trade-panel:${formKey}`}
              />
            </Stack>
          </AccountSelectorProviderMirror>
        </YStack>
      </ScrollView>
    </YStack>
  );
}

// Web and desktop: the home content, with a column holding Swap & Bridge
// beside it from 1280 on. A token row's Swap fills the column instead of
// opening the Swap modal.
export function HomeTradeDock({
  children,
  showPanel,
}: {
  children: ReactNode;
  showPanel: boolean;
}) {
  // The home's account, not whichever account Swap last traded from.
  const { activeAccount } = useActiveAccount({ num: 0 });
  const importAccountKey =
    buildSwapSelectedTokensColdStartAccountKey(activeAccount);
  const [handoff, setHandoff] = useState<ITradeHandoff>();
  // A hand-off belongs to the account whose row made it: another home account
  // starts the form over, and switching back does not bring it back.
  useEffect(() => {
    setHandoff(undefined);
  }, [importAccountKey]);
  const activeHandoff =
    handoff?.params.importAccountKey === importAccountKey ? handoff : undefined;
  const [, setSettings] = useSettingsAtom();
  const handOffSwap = useCallback(
    (params: ITokenSwapHandoffParams) => {
      // What the Swap modal does when it opens with these params: log the
      // entry, keep the derive type, and send to the user's own account.
      if (params.swapSource) {
        defaultLogger.swap.enterSwap.enterSwap({
          enterFrom: params.swapSource,
        });
      }
      if (params.importDeriveType && params.importNetworkId) {
        void backgroundApiProxy.serviceNetwork.saveGlobalDeriveTypeForNetwork({
          networkId: params.importNetworkId,
          deriveType: params.importDeriveType,
        });
      }
      setSettings((v) =>
        v.swapToAnotherAccountSwitchOn
          ? { ...v, swapToAnotherAccountSwitchOn: false }
          : v,
      );
      setHandoff({ params, at: Date.now() });
    },
    [setSettings],
  );
  return (
    <TokenSwapHandoffContext.Provider
      value={showPanel ? handOffSwap : undefined}
    >
      <XStack flex={1} minHeight={0}>
        {/* The content scrolls here; the column beside it stays. */}
        <YStack flex={1} minWidth={0}>
          {children}
        </YStack>
        {showPanel ? (
          <HomeTradePanel
            handoff={activeHandoff}
            importAccountKey={importAccountKey}
          />
        ) : null}
      </XStack>
    </TokenSwapHandoffContext.Provider>
  );
}
