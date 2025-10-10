import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  IEventActiveAssetCtxParameters,
  IEventActiveAssetDataParameters,
  IEventL2BookParameters,
  IEventUserFillsParameters,
  IEventWebData2Parameters,
  IHex,
  IPerpsSubscriptionParams,
  IWsAllMidsParameters,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

export const SUBSCRIPTION_TYPE_INFO: {
  [type in ESubscriptionType]: {
    eventType: 'market' | 'account';
    priority: number;
  };
} = {
  [ESubscriptionType.ALL_MIDS]: {
    eventType: 'market',
    priority: 1,
  },
  [ESubscriptionType.ACTIVE_ASSET_CTX]: {
    eventType: 'market',
    priority: 2,
  },
  [ESubscriptionType.WEB_DATA2]: {
    eventType: 'account',
    priority: 2,
  },
  [ESubscriptionType.USER_FILLS]: {
    eventType: 'account',
    priority: 2,
  },
  [ESubscriptionType.L2_BOOK]: {
    eventType: 'market',
    priority: 3,
  },
  [ESubscriptionType.TRADES]: {
    eventType: 'market',
    priority: 4,
  },
  [ESubscriptionType.BBO]: {
    eventType: 'market',
    priority: 3,
  },
  [ESubscriptionType.ACTIVE_ASSET_DATA]: {
    eventType: 'account',
    priority: 3,
  },
  [ESubscriptionType.USER_EVENTS]: {
    eventType: 'account',
    priority: 2,
  },
  [ESubscriptionType.USER_NOTIFICATIONS]: {
    eventType: 'account',
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

  const allMidsParams: IWsAllMidsParameters = {
    // dex: '',
  };
  specs.push(
    buildSubscriptionSpec({
      type: ESubscriptionType.ALL_MIDS,
      params: allMidsParams,
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

  if (state.currentUser) {
    const webData2Params: IEventWebData2Parameters = {
      user: state.currentUser,
    };
    specs.push(
      buildSubscriptionSpec({
        type: ESubscriptionType.WEB_DATA2,
        params: webData2Params,
      }),
    );

    const userFillsParams: IEventUserFillsParameters = {
      user: state.currentUser,
      aggregateByTime: true,
    };
    specs.push(
      buildSubscriptionSpec({
        type: ESubscriptionType.USER_FILLS,
        params: userFillsParams,
      }),
    );

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
