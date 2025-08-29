import type * as HL from '@nktkas/hyperliquid';
import { ZeroAddress } from 'ethersV6';

export type SubscriptionType = 
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

export interface SubscriptionParams {
  allMids: {};
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

export interface SubscriptionConfig<T extends SubscriptionType = SubscriptionType> {
  readonly type: T;
  readonly method: keyof HL.SubscriptionClient;
  readonly processor: string;
  readonly eventType: 'market' | 'account';
  readonly eventSubType: SubscriptionType;
  readonly keyGenerator: (params: any) => string;
  readonly priority: number;
}

export const SUBSCRIPTION_CONFIGS: Record<SubscriptionType, SubscriptionConfig> = {
  allMids: {
    type: 'allMids',
    method: 'allMids',
    processor: 'AllMidsProcessor',
    eventType: 'market',
    eventSubType: 'allMids',
    keyGenerator: () => 'market:allMids',
    priority: 1,
  },

  activeAssetCtx: {
    type: 'activeAssetCtx',
    method: 'activeAssetCtx',
    processor: 'ActiveAssetCtxProcessor',
    eventType: 'market',
    eventSubType: 'activeAssetCtx',
    keyGenerator: (params) => `market:activeAssetCtx:${params.coin}`,
    priority: 2,
  },

  webData2: {
    type: 'webData2',
    method: 'webData2',
    processor: 'WebData2Processor',
    eventType: 'account',
    eventSubType: 'webData2',
    keyGenerator: (params) => `account:webData2:${params.user}`,
    priority: 2,
  },

  l2Book: {
    type: 'l2Book',
    method: 'l2Book',
    processor: 'L2BookProcessor',
    eventType: 'market',
    eventSubType: 'l2Book',
    keyGenerator: (params) => `market:l2Book:${params.coin}`,
    priority: 3,
  },

  candles: {
    type: 'candles',
    method: 'candle',
    processor: 'CandleProcessor',
    eventType: 'market',
    eventSubType: 'candles',
    keyGenerator: (params) => `market:candles:${params.coin}:${params.interval}`,
    priority: 4,
  },

  trades: {
    type: 'trades',
    method: 'trades',
    processor: 'TradesProcessor',
    eventType: 'market',
    eventSubType: 'trades',
    keyGenerator: (params) => `market:trades:${params.coin}`,
    priority: 4,
  },

  bbo: {
    type: 'bbo',
    method: 'bbo',
    processor: 'BBOProcessor',
    eventType: 'market',
    eventSubType: 'bbo',
    keyGenerator: (params) => `market:bbo:${params.coin}`,
    priority: 3,
  },

  activeAssetData: {
    type: 'activeAssetData',
    method: 'activeAssetData',
    processor: 'ActiveAssetDataProcessor',
    eventType: 'account',
    eventSubType: 'activeAssetData',
    keyGenerator: (params) => `account:activeAssetData:${params.user}:${params.coin}`,
    priority: 3,
  },

  userEvents: {
    type: 'userEvents',
    method: 'userEvents',
    processor: 'UserEventsProcessor',
    eventType: 'account',
    eventSubType: 'userEvents',
    keyGenerator: (params) => `account:userEvents:${params.user}`,
    priority: 2,
  },

  userNotifications: {
    type: 'userNotifications',
    method: 'notification',
    processor: 'UserNotificationsProcessor',
    eventType: 'account',
    eventSubType: 'userNotifications',
    keyGenerator: (params) => `account:userNotifications:${params.user}`,
    priority: 3,
  },
};

export interface SubscriptionSpec<T extends SubscriptionType = SubscriptionType> {
  readonly type: T;
  readonly key: string;
  readonly params: SubscriptionParams[T];
  readonly priority: number;
}

export interface SubscriptionState {
  currentUser: `0x${string}` | null;
  currentSymbol: string;
  isConnected: boolean;
}

export interface SubscriptionDiff {
  toSubscribe: SubscriptionSpec[];
  toUnsubscribe: SubscriptionSpec[];
}

export function getSubscriptionConfig<T extends SubscriptionType>(type: T): SubscriptionConfig {
  return SUBSCRIPTION_CONFIGS[type];
}

export function generateSubscriptionKey<T extends SubscriptionType>(
  type: T,
  params: SubscriptionParams[T]
): string {
  const config = getSubscriptionConfig(type);
  return config.keyGenerator(params);
}

export function validateSubscriptionParams<T extends SubscriptionType>(
  type: T,
  params: any
): params is SubscriptionParams[T] {
  const config = getSubscriptionConfig(type);
  
  switch (type) {
    case 'allMids':
      return typeof params === 'object';
    case 'activeAssetCtx':
    case 'l2Book':
    case 'trades':
    case 'bbo':
      return typeof params === 'object' && typeof params.coin === 'string';
    case 'candles':
      return typeof params === 'object' && 
             typeof params.coin === 'string' && 
             typeof params.interval === 'string';
    case 'webData2':
    case 'userEvents':
    case 'userNotifications':
      return typeof params === 'object' && 
             typeof params.user === 'string' && 
             params.user.startsWith('0x');
    case 'activeAssetData':
      return typeof params === 'object' && 
             typeof params.user === 'string' && 
             params.user.startsWith('0x') && 
             typeof params.coin === 'string';
    default:
      return false;
  }
}

export function calculateRequiredSubscriptions(state: SubscriptionState): SubscriptionSpec[] {
  const specs: SubscriptionSpec[] = [];

  specs.push({
    type: 'allMids',
    key: generateSubscriptionKey('allMids', {}),
    params: {},
    priority: SUBSCRIPTION_CONFIGS.allMids.priority,
  });

  if (state.currentSymbol) {
    specs.push({
      type: 'activeAssetCtx',
      key: generateSubscriptionKey('activeAssetCtx', { coin: state.currentSymbol }),
      params: { coin: state.currentSymbol },
      priority: SUBSCRIPTION_CONFIGS.activeAssetCtx.priority,
    });

    // specs.push({
    //   type: 'l2Book',
    //   key: generateSubscriptionKey('l2Book', { coin: state.currentSymbol }),
    //   params: { coin: state.currentSymbol },
    //   priority: SUBSCRIPTION_CONFIGS.l2Book.priority,
    // });

    // specs.push({
    //   type: 'trades',
    //   key: generateSubscriptionKey('trades', { coin: state.currentSymbol }),
    //   params: { coin: state.currentSymbol },
    //   priority: SUBSCRIPTION_CONFIGS.trades.priority,
    // });

    // specs.push({
    //   type: 'candles',
    //   key: generateSubscriptionKey('candles', { coin: state.currentSymbol, interval: '1h' }),
    //   params: { coin: state.currentSymbol, interval: '1h' },
    //   priority: SUBSCRIPTION_CONFIGS.candles.priority,
    // });
  }

  const effectiveUser = state.currentUser || ZeroAddress as `0x${string}`;
  
  specs.push({
    type: 'webData2',
    key: generateSubscriptionKey('webData2', { user: effectiveUser }),
    params: { user: effectiveUser },
    priority: SUBSCRIPTION_CONFIGS.webData2.priority,
  });

  if (state.currentUser && state.currentUser !== ZeroAddress) {
    // specs.push({
    //   type: 'userEvents',
    //   key: generateSubscriptionKey('userEvents', { user: state.currentUser }),
    //   params: { user: state.currentUser },
    //   priority: SUBSCRIPTION_CONFIGS.userEvents.priority,
    // });

    // specs.push({
    //   type: 'userNotifications',
    //   key: generateSubscriptionKey('userNotifications', { user: state.currentUser }),
    //   params: { user: state.currentUser },
    //   priority: SUBSCRIPTION_CONFIGS.userNotifications.priority,
    // });

    if (state.currentSymbol) {
      specs.push({
        type: 'activeAssetData',
        key: generateSubscriptionKey('activeAssetData', { 
          user: state.currentUser, 
          coin: state.currentSymbol 
        }),
        params: { user: state.currentUser, coin: state.currentSymbol },
        priority: SUBSCRIPTION_CONFIGS.activeAssetData.priority,
      });
    }
  }

  return specs.sort((a, b) => a.priority - b.priority);
}

export function sortSubscriptionsByPriority(specs: SubscriptionSpec[]): SubscriptionSpec[] {
  return [...specs].sort((a, b) => a.priority - b.priority);
}

export function calculateSubscriptionDiff(
  currentSpecs: SubscriptionSpec[],
  newSpecs: SubscriptionSpec[]
): SubscriptionDiff {
  const currentKeys = new Set(currentSpecs.map(spec => spec.key));
  const newKeys = new Set(newSpecs.map(spec => spec.key));

  return {
    toUnsubscribe: currentSpecs.filter(spec => !newKeys.has(spec.key)),
    toSubscribe: sortSubscriptionsByPriority(newSpecs.filter(spec => !currentKeys.has(spec.key))),
  };
}
