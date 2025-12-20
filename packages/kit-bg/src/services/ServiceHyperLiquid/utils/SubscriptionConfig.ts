import { PERPS_EMPTY_ADDRESS } from '@onekeyhq/shared/src/consts/perp';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  IEventActiveAssetCtxParameters,
  IEventActiveAssetDataParameters,
  IEventAllDexsClearinghouseStateParameters,
  IEventL2BookParameters,
  IEventOpenOrdersParameters,
  IEventUserFillsParameters,
  IEventUserNonFundingLedgerUpdatesParameters,
  IHex,
  IPerpsSubscriptionParams,
  IWsAllMidsParameters,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';
import {
  EPerpsSubscriptionCategory,
  ESubscriptionType,
} from '@onekeyhq/shared/types/hyperliquid/types';

export const SUBSCRIPTION_TYPE_INFO: {
  [type in ESubscriptionType]: {
    eventType: EPerpsSubscriptionCategory;
    priority: number;
  };
} = {
  [ESubscriptionType.ALL_MIDS]: {
    eventType: EPerpsSubscriptionCategory.MARKET,
    priority: 1,
  },
  [ESubscriptionType.ACTIVE_ASSET_CTX]: {
    eventType: EPerpsSubscriptionCategory.MARKET,
    priority: 2,
  },
  [ESubscriptionType.WEB_DATA2]: {
    eventType: EPerpsSubscriptionCategory.ACCOUNT,
    priority: 2,
  },
  [ESubscriptionType.WEB_DATA3]: {
    eventType: EPerpsSubscriptionCategory.ACCOUNT,
    priority: 2,
  },
  [ESubscriptionType.ALL_DEXS_CLEARINGHOUSE_STATE]: {
    eventType: EPerpsSubscriptionCategory.ACCOUNT,
    priority: 2,
  },
  [ESubscriptionType.OPEN_ORDERS]: {
    eventType: EPerpsSubscriptionCategory.ACCOUNT,
    priority: 2,
  },
  [ESubscriptionType.ALL_DEXS_ASSET_CTXS]: {
    eventType: EPerpsSubscriptionCategory.MARKET,
    priority: 2,
  },
  [ESubscriptionType.TWAP_STATES]: {
    eventType: EPerpsSubscriptionCategory.ACCOUNT,
    priority: 2,
  },
  [ESubscriptionType.USER_FILLS]: {
    eventType: EPerpsSubscriptionCategory.ACCOUNT,
    priority: 2,
  },
  [ESubscriptionType.USER_NON_FUNDING_LEDGER_UPDATES]: {
    eventType: EPerpsSubscriptionCategory.ACCOUNT,
    priority: 2,
  },
  [ESubscriptionType.L2_BOOK]: {
    eventType: EPerpsSubscriptionCategory.MARKET,
    priority: 3,
  },
  [ESubscriptionType.ACTIVE_ASSET_DATA]: {
    eventType: EPerpsSubscriptionCategory.ACCOUNT,
    priority: 3,
  },
};

export interface ISubscriptionSpec<T extends ESubscriptionType> {
  readonly type: T;
  readonly key: string;
  readonly params: IPerpsSubscriptionParams[T];
  readonly priority: number;
}

export interface ISubscriptionState {
  currentUser: IHex | null;
  currentSymbol: string;
  isConnected: boolean;
  l2BookOptions?: IL2BookOptions | null;
  enableLedgerUpdates?: boolean;
}

export interface ISubscriptionDiff {
  toUnsubscribe: ISubscriptionSpec<ESubscriptionType>[];
  toSubscribe: ISubscriptionSpec<ESubscriptionType>[];
}

export function generateSubscriptionKey<T extends ESubscriptionType>(
  type: T,
  params: IPerpsSubscriptionParams[T],
): string {
  return stringUtils.stableStringify({
    type,
    params,
  });
  // return SUBSCRIPTION_TYPE_INFO[type].keyGenerator(params);
}

export function getSubscriptionPriority(type: ESubscriptionType): number {
  return SUBSCRIPTION_TYPE_INFO[type].priority;
}

function buildSubscriptionSpec<T extends ESubscriptionType>({
  type,
  params,
}: {
  type: T;
  params: IPerpsSubscriptionParams[T];
}): ISubscriptionSpec<T> {
  return {
    type,
    key: generateSubscriptionKey(type, params),
    params,
    priority: getSubscriptionPriority(type),
  };
}

export function calculateRequiredSubscriptions(
  state: ISubscriptionState,
): ISubscriptionSpec<ESubscriptionType>[] {
  const specs: ISubscriptionSpec<ESubscriptionType>[] = [];

  // Market Data: All Mids (Global)
  // TODO: verify if 'dex' parameter is supported in sdk/types for IWsAllMidsParameters
  // The user log shows {"type":"allMids","dex":"ALL_DEXS"}, so we include it.
  const allMidsParams: IWsAllMidsParameters = {
    // @ts-ignore
    dex: 'ALL_DEXS',
  };
  specs.push(
    buildSubscriptionSpec({
      type: ESubscriptionType.ALL_MIDS,
      params: allMidsParams,
    }),
  );

  // Market Data: All Dexs Asset Contexts (Global) - Replaces per-asset context?
  // User log shows {"type":"allDexsAssetCtxs"}
  const allDexsAssetCtxsParams = {};
  specs.push(
    buildSubscriptionSpec({
      type: ESubscriptionType.ALL_DEXS_ASSET_CTXS,
      params: allDexsAssetCtxsParams,
    }),
  );

  if (state.currentSymbol) {
    const activeAssetCtxParams: IEventActiveAssetCtxParameters = {
      coin: state.currentSymbol,
    };
    specs.push(
      buildSubscriptionSpec({
        type: ESubscriptionType.ACTIVE_ASSET_CTX,
        params: activeAssetCtxParams,
      }),
    );

    const activeAssetDataParams: IEventActiveAssetDataParameters = {
      coin: state.currentSymbol,
      user: state.currentUser || PERPS_EMPTY_ADDRESS,
    };
    specs.push(
      buildSubscriptionSpec({
        type: ESubscriptionType.ACTIVE_ASSET_DATA,
        params: activeAssetDataParams,
      }),
    );

    if (state.l2BookOptions) {
      // Create L2_BOOK subscription with default parameters if no custom params are provided
      const l2BookParams: IEventL2BookParameters = {
        coin: state.currentSymbol,
        nSigFigs: state.l2BookOptions.nSigFigs ?? null,
        mantissa: state.l2BookOptions.mantissa ?? null,
      };
      specs.push(
        buildSubscriptionSpec({
          type: ESubscriptionType.L2_BOOK,
          params: l2BookParams,
        }),
      );
    }
  }

  // User Data
  if (state.currentUser) {
    const allDexsClearinghouseStateParams: IEventAllDexsClearinghouseStateParameters =
      {
        user: state.currentUser,
      };
    specs.push(
      buildSubscriptionSpec({
        type: ESubscriptionType.ALL_DEXS_CLEARINGHOUSE_STATE,
        params: allDexsClearinghouseStateParams,
      }),
    );

    const openOrdersParams: IEventOpenOrdersParameters = {
      user: state.currentUser,
      dex: 'ALL_DEXS',
    };
    specs.push(
      buildSubscriptionSpec({
        type: ESubscriptionType.OPEN_ORDERS,
        params: openOrdersParams,
      }),
    );
    specs.push(
      buildSubscriptionSpec({
        type: ESubscriptionType.WEB_DATA3,
        params: {
          user: state.currentUser,
        },
      }),
    );
    const userFillsParams: IEventUserFillsParameters = {
      user: state.currentUser,
      aggregateByTime: true,
      // @ts-ignore
      // reversed: true, // not working
    };
    specs.push(
      buildSubscriptionSpec({
        type: ESubscriptionType.USER_FILLS,
        params: userFillsParams,
      }),
    );

    if (state.enableLedgerUpdates) {
      const ledgerUpdatesParams: IEventUserNonFundingLedgerUpdatesParameters = {
        user: state.currentUser,
      };
      specs.push(
        buildSubscriptionSpec({
          type: ESubscriptionType.USER_NON_FUNDING_LEDGER_UPDATES,
          params: ledgerUpdatesParams,
        }),
      );
    }

    // Legacy or specific per-asset data (Optional, based on need.
    // Usually WebData3 covers general state, but if specific asset data needed:
    // User log implies global subscriptions are preferred.)
    /*
    if (state.currentSymbol) {
      const activeAssetDataParams: IEventActiveAssetDataParameters = {
        user: state.currentUser,
        coin: state.currentSymbol,
      };
      specs.push(
        buildSubscriptionSpec({
          type: ESubscriptionType.ACTIVE_ASSET_DATA,
          params: activeAssetDataParams,
        }),
      );
    }
    */
  } else {
    // WebData3 requires a user address.
    // If no user, we likely only need market data (handled above).
  }

  return specs.sort((a, b) => a.priority - b.priority);
}

export function calculateRequiredSubscriptionsMap(state: ISubscriptionState) {
  const specs = calculateRequiredSubscriptions(state);
  const map: Record<string, ISubscriptionSpec<ESubscriptionType>> = {};
  for (const spec of specs) {
    map[spec.key] = spec;
  }
  return map;
}

export function sortSubscriptionsByPriority(
  specs: ISubscriptionSpec<ESubscriptionType>[],
): ISubscriptionSpec<ESubscriptionType>[] {
  return [...specs].sort((a, b) => a.priority - b.priority);
}

export function calculateSubscriptionDiff(
  currentSpecs: ISubscriptionSpec<ESubscriptionType>[],
  newSpecs: ISubscriptionSpec<ESubscriptionType>[],
): ISubscriptionDiff {
  const currentKeys = new Set(currentSpecs.map((spec) => spec.key));
  const newKeys = new Set(newSpecs.map((spec) => spec.key));

  const toUnsubscribe = currentSpecs.filter((spec) => !newKeys.has(spec.key));
  const toSubscribe = sortSubscriptionsByPriority(
    newSpecs.filter((spec) => !currentKeys.has(spec.key)),
  );

  return {
    toUnsubscribe,
    toSubscribe,
  };
}
