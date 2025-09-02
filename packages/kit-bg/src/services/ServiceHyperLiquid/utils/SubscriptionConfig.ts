import { ZeroAddress } from 'ethersV6';

import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';

export type ISubscriptionType =
  | 'allMids'
  | 'activeAssetCtx'
  | 'webData2'
  | 'l2Book'
  | 'candles'
  | 'trades'
  | 'bbo'
  | 'activeAssetData'
  | 'userEvents'
  | 'userNotifications';

export interface ISubscriptionParams {
  allMids: Record<string, never>;
  activeAssetCtx: { coin: string };
  webData2: { user: `0x${string}` };
  l2Book: { coin: string };
  candles: { coin: string; interval: string };
  trades: { coin: string };
  bbo: { coin: string };
  activeAssetData: { user: `0x${string}`; coin: string };
  userEvents: { user: `0x${string}` };
  userNotifications: { user: `0x${string}` };
}

export interface ISubscriptionConfig<
  T extends ISubscriptionType = ISubscriptionType,
> {
  readonly type: T;
  readonly method: keyof HL.ISubscriptionClient;
  readonly eventType: 'market' | 'account';
  readonly eventSubType: ISubscriptionType;
  readonly keyGenerator: (params: ISubscriptionParams[T]) => string;
  readonly priority: number;
}

export const SUBSCRIPTION_CONFIGS: Record<
  ISubscriptionType,
  ISubscriptionConfig<any>
> = {
  allMids: {
    type: 'allMids',
    method: 'allMids',
    eventType: 'market',
    eventSubType: 'allMids',
    keyGenerator: () => 'market:allMids',
    priority: 1,
  },

  activeAssetCtx: {
    type: 'activeAssetCtx',
    method: 'activeAssetCtx',
    eventType: 'market',
    eventSubType: 'activeAssetCtx',
    keyGenerator: (params: { coin: string }) =>
      `market:activeAssetCtx:${params.coin}`,
    priority: 2,
  },

  webData2: {
    type: 'webData2',
    method: 'webData2',
    eventType: 'account',
    eventSubType: 'webData2',
    keyGenerator: (params: { user: `0x${string}` }) =>
      `account:webData2:${params.user}`,
    priority: 2,
  },

  l2Book: {
    type: 'l2Book',
    method: 'l2Book',
    eventType: 'market',
    eventSubType: 'l2Book',
    keyGenerator: (params: { coin: string }) => `market:l2Book:${params.coin}`,
    priority: 3,
  },

  candles: {
    type: 'candles',
    method: 'candle',
    eventType: 'market',
    eventSubType: 'candles',
    keyGenerator: (params: { coin: string; interval: string }) =>
      `market:candles:${params.coin}:${params.interval}`,
    priority: 4,
  },

  trades: {
    type: 'trades',
    method: 'trades',
    eventType: 'market',
    eventSubType: 'trades',
    keyGenerator: (params: { coin: string }) => `market:trades:${params.coin}`,
    priority: 4,
  },

  bbo: {
    type: 'bbo',
    method: 'bbo',
    eventType: 'market',
    eventSubType: 'bbo',
    keyGenerator: (params: { coin: string }) => `market:bbo:${params.coin}`,
    priority: 3,
  },

  activeAssetData: {
    type: 'activeAssetData',
    method: 'activeAssetData',
    eventType: 'account',
    eventSubType: 'activeAssetData',
    keyGenerator: (params: { user: `0x${string}`; coin: string }) =>
      `account:activeAssetData:${params.user}:${params.coin}`,
    priority: 3,
  },

  userEvents: {
    type: 'userEvents',
    method: 'userEvents',
    eventType: 'account',
    eventSubType: 'userEvents',
    keyGenerator: (params: { user: `0x${string}` }) =>
      `account:userEvents:${params.user}`,
    priority: 2,
  },

  userNotifications: {
    type: 'userNotifications',
    method: 'notification',
    eventType: 'account',
    eventSubType: 'userNotifications',
    keyGenerator: (params: { user: `0x${string}` }) =>
      `account:userNotifications:${params.user}`,
    priority: 3,
  },
};

export interface ISubscriptionSpec<
  T extends ISubscriptionType = ISubscriptionType,
> {
  readonly type: T;
  readonly key: string;
  readonly params: ISubscriptionParams[T];
  readonly priority: number;
}

export interface ISubscriptionState {
  currentUser: `0x${string}` | null;
  currentSymbol: string;
  currentCandleInterval: string;
  isConnected: boolean;
}

export interface ISubscriptionDiff {
  toSubscribe: ISubscriptionSpec[];
  toUnsubscribe: ISubscriptionSpec[];
}

export function getSubscriptionConfig<T extends ISubscriptionType>(
  type: T,
): ISubscriptionConfig<T> {
  return SUBSCRIPTION_CONFIGS[type] as ISubscriptionConfig<T>;
}

export function generateSubscriptionKey<T extends ISubscriptionType>(
  type: T,
  params: ISubscriptionParams[T],
): string {
  const config = getSubscriptionConfig(type);
  return config.keyGenerator(params);
}

export function validateSubscriptionParams<T extends ISubscriptionType>(
  type: T,
  params: unknown,
): params is ISubscriptionParams[T] {
  if (typeof params !== 'object' || params === null) {
    return false;
  }

  const obj = params as Record<string, unknown>;

  switch (type) {
    case 'allMids':
      return typeof params === 'object';
    case 'activeAssetCtx':
    case 'l2Book':
    case 'trades':
    case 'bbo':
      return 'coin' in obj && typeof obj.coin === 'string';
    case 'candles':
      return (
        'coin' in obj &&
        'interval' in obj &&
        typeof obj.coin === 'string' &&
        typeof obj.interval === 'string'
      );
    case 'webData2':
    case 'userEvents':
    case 'userNotifications':
      return (
        'user' in obj &&
        typeof obj.user === 'string' &&
        obj.user.startsWith('0x')
      );
    case 'activeAssetData':
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
    type: 'allMids',
    key: generateSubscriptionKey('allMids', {} as Record<string, never>),
    params: {} as Record<string, never>,
    priority: SUBSCRIPTION_CONFIGS.allMids.priority,
  });

  if (state.currentSymbol) {
    specs.push({
      type: 'activeAssetCtx',
      key: generateSubscriptionKey('activeAssetCtx', {
        coin: state.currentSymbol,
      }),
      params: { coin: state.currentSymbol },
      priority: SUBSCRIPTION_CONFIGS.activeAssetCtx.priority,
    });

    specs.push({
      type: 'l2Book',
      key: generateSubscriptionKey('l2Book', { coin: state.currentSymbol }),
      params: { coin: state.currentSymbol },
      priority: SUBSCRIPTION_CONFIGS.l2Book.priority,
    });

    if (state.currentCandleInterval) {
      specs.push({
        type: 'candles',
        key: generateSubscriptionKey('candles', {
          coin: state.currentSymbol,
          interval: state.currentCandleInterval,
        }),
        params: {
          coin: state.currentSymbol,
          interval: state.currentCandleInterval,
        },
        priority: SUBSCRIPTION_CONFIGS.candles.priority,
      });
    }
  }

  const effectiveUser = state.currentUser || (ZeroAddress as `0x${string}`);

  specs.push({
    type: 'webData2',
    key: generateSubscriptionKey('webData2', { user: effectiveUser }),
    params: { user: effectiveUser },
    priority: SUBSCRIPTION_CONFIGS.webData2.priority,
  });

  if (state.currentUser && state.currentUser !== ZeroAddress) {
    if (state.currentSymbol) {
      specs.push({
        type: 'activeAssetData',
        key: generateSubscriptionKey('activeAssetData', {
          user: state.currentUser,
          coin: state.currentSymbol,
        }),
        params: { user: state.currentUser, coin: state.currentSymbol },
        priority: SUBSCRIPTION_CONFIGS.activeAssetData.priority,
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
