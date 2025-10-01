import { PERPS_EMPTY_ADDRESS } from '@onekeyhq/shared/src/consts/perp';
import type {
  IBook,
  IEventActiveAssetCtxParameters,
  IEventActiveAssetDataParameters,
  IEventBboParameters,
  IEventL2BookParameters,
  IEventNotificationParameters,
  IEventTradesParameters,
  IEventUserEventsParameters,
  IEventUserFillsParameters,
  IEventWebData2Parameters,
  IHex,
  IPerpsActiveAssetDataRaw,
  IPerpsSubscription,
  ISubscriptionClient,
  IWsAllMids,
  IWsAllMidsParameters,
  IWsBbo,
  IWsNotification,
  IWsUserEvent,
  IWsUserFills,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

export const SUBSCRIPTION_TYPE_INFO: {
  [type in ESubscriptionType]: {
    eventType: 'market' | 'account';
    priority: number;
    keyGenerator: (params: any) => string;
    createSubscription: (
      client: ISubscriptionClient,
      params: any,
      handleData: (data: any) => void,
    ) => Promise<IPerpsSubscription>;
  };
} = {
  [ESubscriptionType.ALL_MIDS]: {
    eventType: 'market',
    priority: 1,
    keyGenerator: (_params: IWsAllMidsParameters) => 'market:allMids',
    createSubscription: (
      client: ISubscriptionClient,
      params: IWsAllMidsParameters,
      handleData: (data: IWsAllMids) => void,
    ) => client.allMids(params, handleData),
  },
  [ESubscriptionType.ACTIVE_ASSET_CTX]: {
    eventType: 'market',
    priority: 2,
    keyGenerator: (params: IEventActiveAssetCtxParameters) =>
      `market:activeAssetCtx:${params.coin}`,
    createSubscription: (
      client: ISubscriptionClient,
      params: IEventActiveAssetCtxParameters,
      handleData: (data: any) => void,
    ) => client.activeAssetCtx(params, handleData),
  },
  [ESubscriptionType.WEB_DATA2]: {
    eventType: 'account',
    priority: 2,
    keyGenerator: (params: IEventWebData2Parameters) =>
      `account:webData2:${params.user}`,
    createSubscription: (
      client: ISubscriptionClient,
      params: IEventWebData2Parameters,
      handleData: (data: IWsWebData2) => void,
    ) => client.webData2(params, handleData),
  },
  [ESubscriptionType.USER_FILLS]: {
    eventType: 'account',
    priority: 2,
    keyGenerator: (params: IEventUserFillsParameters) =>
      `account:userFills:${params.user}`,
    createSubscription: (
      client: ISubscriptionClient,
      params: IEventUserFillsParameters,
      handleData: (data: IWsUserFills) => void,
    ) => client.userFills(params, handleData),
  },
  [ESubscriptionType.L2_BOOK]: {
    eventType: 'market',
    priority: 3,
    keyGenerator: (params: IEventL2BookParameters) => {
      // Always include all parameters in the key for consistency
      // Use 'null' for null/undefined values to be explicit
      const nSigFigs =
        params.nSigFigs !== undefined && params.nSigFigs !== null
          ? params.nSigFigs.toString()
          : 'null';
      const mantissa =
        params.mantissa !== undefined && params.mantissa !== null
          ? params.mantissa.toString()
          : 'null';

      return `market:l2Book:${params.coin}:nSigFigs-${nSigFigs}:mantissa-${mantissa}`;
    },
    createSubscription: (
      client: ISubscriptionClient,
      params: IEventL2BookParameters,
      handleData: (data: IBook) => void,
    ) => client.l2Book(params, handleData),
  },
  [ESubscriptionType.TRADES]: {
    eventType: 'market',
    priority: 4,
    keyGenerator: (params: IEventTradesParameters) =>
      `market:trades:${params.coin}`,
    createSubscription: (
      client: ISubscriptionClient,
      params: IEventTradesParameters,
      handleData: (data: any) => void,
    ) => client.trades(params, handleData),
  },
  [ESubscriptionType.BBO]: {
    eventType: 'market',
    priority: 3,
    keyGenerator: (params: IEventBboParameters) => `market:bbo:${params.coin}`,
    createSubscription: (
      client: ISubscriptionClient,
      params: IEventBboParameters,
      handleData: (data: IWsBbo) => void,
    ) => client.bbo(params, handleData),
  },
  [ESubscriptionType.ACTIVE_ASSET_DATA]: {
    eventType: 'account',
    priority: 3,
    keyGenerator: (params: IEventActiveAssetDataParameters) =>
      `account:activeAssetData:${params.user}:${params.coin}`,
    createSubscription: (
      client: ISubscriptionClient,
      params: IEventActiveAssetDataParameters,
      handleData: (data: IPerpsActiveAssetDataRaw) => void,
    ) => client.activeAssetData(params, handleData),
  },
  [ESubscriptionType.USER_EVENTS]: {
    eventType: 'account',
    priority: 2,
    keyGenerator: (params: IEventUserEventsParameters) =>
      `account:userEvents:${params.user}`,
    createSubscription: (
      client: ISubscriptionClient,
      params: IEventUserEventsParameters,
      handleData: (data: IWsUserEvent) => void,
    ) => client.userEvents(params, handleData),
  },
  [ESubscriptionType.USER_NOTIFICATIONS]: {
    eventType: 'account',
    priority: 3,
    keyGenerator: (params: IEventNotificationParameters) =>
      `account:userNotifications:${params.user}`,
    createSubscription: (
      client: ISubscriptionClient,
      params: IEventNotificationParameters,
      handleData: (data: IWsNotification) => void,
    ) => client.notification(params, handleData),
  },
};

export interface ISubscriptionSpec {
  readonly type: ESubscriptionType;
  readonly key: string;
  readonly params: any;
  readonly priority: number;
}

export interface ISubscriptionState {
  currentUser: IHex | null;
  currentSymbol: string;
  isConnected: boolean;
  l2BookOptions?: IL2BookOptions | null;
}

export interface ISubscriptionDiff {
  toSubscribe: ISubscriptionSpec[];
  toUnsubscribe: ISubscriptionSpec[];
}

export function generateSubscriptionKey(
  type: ESubscriptionType,
  params: any,
): string {
  return SUBSCRIPTION_TYPE_INFO[type].keyGenerator(params);
}

export function createSubscription(
  type: ESubscriptionType,
  client: ISubscriptionClient,
  params: any,
  handleData: (data: any) => void,
): Promise<unknown> {
  return SUBSCRIPTION_TYPE_INFO[type].createSubscription(
    client,
    params,
    handleData,
  );
}

export function getSubscriptionPriority(type: ESubscriptionType): number {
  return SUBSCRIPTION_TYPE_INFO[type].priority;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const EMPTY_PARAMS: Record<string, never> = {};

export function validateSubscriptionParams(
  type: ESubscriptionType,
  params: unknown,
): params is any {
  if (!isRecord(params)) {
    return false;
  }

  const obj = params;

  switch (type) {
    case ESubscriptionType.ALL_MIDS:
      return typeof params === 'object';
    case ESubscriptionType.ACTIVE_ASSET_CTX:
    case ESubscriptionType.TRADES:
    case ESubscriptionType.BBO:
      return 'coin' in obj && typeof obj.coin === 'string';
    case ESubscriptionType.L2_BOOK:
      return (
        'coin' in obj &&
        typeof obj.coin === 'string' &&
        (obj.nSigFigs === undefined ||
          obj.nSigFigs === null ||
          [2, 3, 4, 5].includes(obj.nSigFigs as number)) &&
        (obj.mantissa === undefined ||
          obj.mantissa === null ||
          (obj.nSigFigs === 5 && [1, 2, 5].includes(obj.mantissa as number)))
      );
    case ESubscriptionType.WEB_DATA2:
    case ESubscriptionType.USER_FILLS:
    case ESubscriptionType.USER_EVENTS:
    case ESubscriptionType.USER_NOTIFICATIONS:
      return (
        'user' in obj &&
        typeof obj.user === 'string' &&
        obj.user.startsWith('0x')
      );
    case ESubscriptionType.ACTIVE_ASSET_DATA:
      return (
        'user' in obj &&
        'coin' in obj &&
        typeof obj.user === 'string' &&
        obj.user.startsWith('0x') &&
        typeof obj.coin === 'string'
      );
    default:
      return false;
  }
}

export function calculateRequiredSubscriptions(
  state: ISubscriptionState,
): ISubscriptionSpec[] {
  const specs: ISubscriptionSpec[] = [];

  specs.push({
    type: ESubscriptionType.ALL_MIDS,
    key: generateSubscriptionKey(ESubscriptionType.ALL_MIDS, EMPTY_PARAMS),
    params: EMPTY_PARAMS,
    priority: getSubscriptionPriority(ESubscriptionType.ALL_MIDS),
  });

  if (state.currentSymbol) {
    specs.push({
      type: ESubscriptionType.ACTIVE_ASSET_CTX,
      key: generateSubscriptionKey(ESubscriptionType.ACTIVE_ASSET_CTX, {
        coin: state.currentSymbol,
      }),
      params: { coin: state.currentSymbol },
      priority: getSubscriptionPriority(ESubscriptionType.ACTIVE_ASSET_CTX),
    });

    // Create L2_BOOK subscription with default parameters if no custom params are provided
    const l2BookParams = {
      coin: state.currentSymbol,
      ...(state.l2BookOptions || {}),
    };
    const l2BookKey = generateSubscriptionKey(
      ESubscriptionType.L2_BOOK,
      l2BookParams,
    );
    specs.push({
      type: ESubscriptionType.L2_BOOK,
      key: l2BookKey,
      params: l2BookParams,
      priority: getSubscriptionPriority(ESubscriptionType.L2_BOOK),
    });
  }

  const effectiveUser = state.currentUser || PERPS_EMPTY_ADDRESS;

  specs.push({
    type: ESubscriptionType.WEB_DATA2,
    key: generateSubscriptionKey(ESubscriptionType.WEB_DATA2, {
      user: effectiveUser,
    }),
    params: { user: effectiveUser },
    priority: getSubscriptionPriority(ESubscriptionType.WEB_DATA2),
  });

  specs.push({
    type: ESubscriptionType.USER_FILLS,
    key: generateSubscriptionKey(ESubscriptionType.USER_FILLS, {
      user: effectiveUser,
    }),
    params: { user: effectiveUser },
    priority: getSubscriptionPriority(ESubscriptionType.USER_FILLS),
  });

  if (state.currentUser && state.currentUser !== PERPS_EMPTY_ADDRESS) {
    if (state.currentSymbol) {
      specs.push({
        type: ESubscriptionType.ACTIVE_ASSET_DATA,
        key: generateSubscriptionKey(ESubscriptionType.ACTIVE_ASSET_DATA, {
          user: state.currentUser,
          coin: state.currentSymbol,
        }),
        params: { user: state.currentUser, coin: state.currentSymbol },
        priority: getSubscriptionPriority(ESubscriptionType.ACTIVE_ASSET_DATA),
      });
    }
  }

  return specs.sort((a, b) => a.priority - b.priority);
}

export function sortSubscriptionsByPriority(
  specs: ISubscriptionSpec[],
): ISubscriptionSpec[] {
  return [...specs].sort((a, b) => a.priority - b.priority);
}

export function calculateSubscriptionDiff(
  currentSpecs: ISubscriptionSpec[],
  newSpecs: ISubscriptionSpec[],
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
