import { ZERO_ADDRESS } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IActiveAssetData,
  IBook,
  IEventActiveAssetCtxParameters,
  IEventActiveAssetDataParameters,
  IEventBboParameters,
  IEventL2BookParameters,
  IEventNotificationParameters,
  IEventTradesParameters,
  IEventUserEventsParameters,
  IEventWebData2Parameters,
  IHex,
  ISubscriptionClient,
  IWsAllMids,
  IWsAllMidsParameters,
  IWsBbo,
  IWsNotification,
  IWsUserEvent,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

export const SUBSCRIPTION_TYPE_INFO = {
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
  [ESubscriptionType.L2_BOOK]: {
    eventType: 'market',
    priority: 3,
    keyGenerator: (params: IEventL2BookParameters) =>
      `market:l2Book:${params.coin}`,
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
      handleData: (data: IActiveAssetData) => void,
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
    case ESubscriptionType.L2_BOOK:
    case ESubscriptionType.TRADES:
    case ESubscriptionType.BBO:
      return 'coin' in obj && typeof obj.coin === 'string';
    case ESubscriptionType.WEB_DATA2:
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

    specs.push({
      type: ESubscriptionType.L2_BOOK,
      key: generateSubscriptionKey(ESubscriptionType.L2_BOOK, {
        coin: state.currentSymbol,
      }),
      params: { coin: state.currentSymbol },
      priority: getSubscriptionPriority(ESubscriptionType.L2_BOOK),
    });
  }

  const effectiveUser = state.currentUser || ZERO_ADDRESS;

  specs.push({
    type: ESubscriptionType.WEB_DATA2,
    key: generateSubscriptionKey(ESubscriptionType.WEB_DATA2, {
      user: effectiveUser,
    }),
    params: { user: effectiveUser },
    priority: getSubscriptionPriority(ESubscriptionType.WEB_DATA2),
  });

  if (state.currentUser && state.currentUser !== ZERO_ADDRESS) {
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

  return {
    toUnsubscribe: currentSpecs.filter((spec) => !newKeys.has(spec.key)),
    toSubscribe: sortSubscriptionsByPriority(
      newSpecs.filter((spec) => !currentKeys.has(spec.key)),
    ),
  };
}
