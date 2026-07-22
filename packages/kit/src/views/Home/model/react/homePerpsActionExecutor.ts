import { rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  perpsPendingInfoPanelTabAtom,
  spotActiveAssetAtom,
  tradingModeAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import type { IHomePerpsLegacyPayload } from '../sections/perps/homePerpsSourceAdapter';

type IHomePerpsTradeMode = 'perp' | 'spot';
type IHomePerpsInfoPanelTab = 'Positions' | 'Balances';

type IHomePerpsAccountIdentity = {
  accountId?: string;
  indexedAccountId?: string;
  walletId?: string;
};

type IHomePerpsDeferredScheduler = (
  callback: () => void,
  delayMs: number,
) => void;

type IHomePerpsOpenAssetCommand = {
  coin: string;
  infoPanelTab: IHomePerpsInfoPanelTab;
  mode: IHomePerpsTradeMode;
  openMarket: boolean;
};

const alwaysCurrent = () => true;
const defaultScheduleDeferred: IHomePerpsDeferredScheduler = (
  callback,
  delayMs,
) => {
  setTimeout(callback, delayMs);
};

async function prepareHomePerpsAccount({
  accountIdentity,
  isCurrent = alwaysCurrent,
}: {
  accountIdentity: IHomePerpsAccountIdentity;
  isCurrent?: () => boolean;
}) {
  if (
    (!accountIdentity.accountId && !accountIdentity.indexedAccountId) ||
    !isCurrent()
  ) {
    return undefined;
  }
  const deriveType =
    await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
      networkId: PERPS_NETWORK_ID,
    });
  if (!isCurrent()) {
    return undefined;
  }
  const activePerpsAccount =
    await backgroundApiProxy.serviceHyperliquid.changeActivePerpsAccount({
      indexedAccountId: accountIdentity.indexedAccountId ?? null,
      accountId: accountIdentity.accountId ?? null,
      walletId: accountIdentity.walletId ?? null,
      deriveType: deriveType ?? 'default',
    });
  return isCurrent() ? activePerpsAccount : undefined;
}

async function executeHomePerpsOpenAsset({
  accountIdentity,
  coin,
  infoPanelTab,
  isCurrent = alwaysCurrent,
  mode = 'perp',
  openMarket = true,
  scheduleDeferred = defaultScheduleDeferred,
  switchToPerps,
}: {
  accountIdentity: IHomePerpsAccountIdentity;
  coin?: string;
  infoPanelTab?: IHomePerpsInfoPanelTab;
  isCurrent?: () => boolean;
  mode?: IHomePerpsTradeMode;
  openMarket?: boolean;
  scheduleDeferred?: IHomePerpsDeferredScheduler;
  switchToPerps: () => void;
}): Promise<boolean> {
  try {
    const activePerpsAccount = await prepareHomePerpsAccount({
      accountIdentity,
      isCurrent,
    });
    if (
      !activePerpsAccount ||
      !isCurrent() ||
      (coin && !activePerpsAccount.accountAddress)
    ) {
      return false;
    }
    if (coin && mode === 'perp') {
      await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({ coin });
      if (!isCurrent()) {
        return false;
      }
      await tradingModeAtom.set('perp');
    } else if (coin && mode === 'spot') {
      await spotActiveAssetAtom.set({
        coin,
        assetId: undefined,
        universe: undefined,
      });
      if (!isCurrent()) {
        return false;
      }
      await tradingModeAtom.set('spot');
    }
    if (!isCurrent()) {
      return false;
    }
    if (infoPanelTab) {
      await perpsPendingInfoPanelTabAtom.set(infoPanelTab);
      if (!isCurrent()) {
        return false;
      }
    }
    switchToPerps();
    if (!coin) {
      return true;
    }
    appEventBus.emit(EAppEventBusNames.PerpSwitchActiveInstrument, {
      mode,
      coin,
    });
    if (infoPanelTab) {
      scheduleDeferred(() => {
        if (isCurrent()) {
          appEventBus.emit(EAppEventBusNames.PerpSwitchInfoPanelTab, {
            tab: infoPanelTab,
          });
        }
      }, 0);
    }
    if (platformEnv.isNative && openMarket) {
      scheduleDeferred(() => {
        if (isCurrent()) {
          rootNavigationRef.current?.navigate(ERootRoutes.Main, {
            screen: ETabRoutes.Perp,
            params: { screen: EModalPerpRoutes.MobilePerpMarket },
          });
        }
      }, 500);
    }
    return true;
  } catch {
    return false;
  }
}

function resolveHomePerpsOpenAssetCommand({
  itemId,
  payload,
}: {
  itemId?: string;
  payload: IHomePerpsLegacyPayload | undefined;
}): IHomePerpsOpenAssetCommand | undefined {
  const holding = payload?.view.holdings.find(
    (candidate, index) => `holding:${candidate.symbol}:${index}` === itemId,
  );
  if (holding?.symbol.toUpperCase() !== 'USDC' && holding?.spotUniverseName) {
    return {
      coin: holding.spotUniverseName,
      infoPanelTab: 'Balances',
      mode: 'spot',
      openMarket: false,
    };
  }
  const position = payload?.view.positions.find(
    (candidate, index) => `position:${candidate.coin}:${index}` === itemId,
  );
  if (!position) {
    return undefined;
  }
  return {
    coin: position.coin,
    infoPanelTab: 'Positions',
    mode: 'perp',
    openMarket: false,
  };
}

export {
  executeHomePerpsOpenAsset,
  prepareHomePerpsAccount,
  resolveHomePerpsOpenAssetCommand,
};
export type {
  IHomePerpsAccountIdentity,
  IHomePerpsDeferredScheduler,
  IHomePerpsInfoPanelTab,
  IHomePerpsOpenAssetCommand,
  IHomePerpsTradeMode,
};
