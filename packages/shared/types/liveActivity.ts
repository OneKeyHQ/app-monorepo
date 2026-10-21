import type { EProtocolOfExchange } from './swap/types';

export type ILiveActivityStatus =
  | 'confirming'
  | 'swapping'
  | 'receiving'
  | 'refunding'
  | 'done'
  | 'failed'
  | 'refunded'
  | 'canceled';

export type ILiveActivityToken = {
  symbol: string;
  iconUrl: string;
  networkName: string;
};

export type ILiveActivityOrder = {
  schemaVersion: 1;
  orderKey: string;
  serviceOrderId?: string;
  depositTxId: string;
  networkId: string;
  provider: string;
  fromToken: ILiveActivityToken;
  toToken: ILiveActivityToken;
  startedAtMs: number;
  estimatedEndAtMs: number;
  expiresAtMs: number;
  isMock: boolean;
};

// Minimal App-to-native request. The native manager derives presentation fields.
export type ILiveActivityContent = {
  status: ILiveActivityStatus;
  updatedAtMs: number;
  revision: number;
};

// Complete ActivityKit ContentState; APNs must send every required field.
export type ILiveActivityPushContent = ILiveActivityContent & {
  displayPhase: 'eta' | 'ring';
  etaMinutes: number;
  almostDone: boolean;
  imageRevision?: number;
  progressStoppedAtMs?: number;
};

export type ILiveActivitySnapshot = {
  order: ILiveActivityOrder;
  content: ILiveActivityContent;
};

export type ILiveActivityInstance = ILiveActivitySnapshot & {
  content: ILiveActivityPushContent;
  activityId: string;
  activityState: string;
  pushRegistration: 'notRequested' | 'pending' | 'registered' | 'failed';
};

export type ILiveActivitySystemStatus = {
  supported: boolean;
  enabled: boolean;
  activities: ILiveActivityInstance[];
};

export type ILiveActivitySubscriptionRequest = {
  schemaVersion: 1;
  activityId: string;
  order: ILiveActivityOrder;
  tracking?: {
    currentDepositTxId: string;
    protocol: EProtocolOfExchange;
    toTokenAddress?: string;
    receivedAddress?: string;
    ctx?: unknown;
  };
};

export type ILiveActivitySubscriptionResult = {
  status: 'registered' | 'awaitingServer' | 'mocked';
  subscriptionId?: string;
  revision: number;
};

export type ILiveActivitySubscriptionTransport = {
  subscribe: (
    request: ILiveActivitySubscriptionRequest,
  ) => Promise<ILiveActivitySubscriptionResult>;
  unsubscribe: (request: {
    activityId: string;
    orderKey: string;
    reason: 'dismissed' | 'terminal' | 'expired';
  }) => Promise<void>;
};

export type ILiveActivityMockScenario =
  | 'success'
  | 'refund'
  | 'failed'
  | 'canceled'
  | 'almostDone'
  | 'longTicker';

export type ILiveActivityModule = {
  getStatus: () => Promise<ILiveActivitySystemStatus>;
  start: (
    snapshot: ILiveActivitySnapshot,
  ) => Promise<ILiveActivitySystemStatus>;
  update: (
    snapshot: ILiveActivitySnapshot,
  ) => Promise<ILiveActivitySystemStatus>;
  end: (orderKey: string) => Promise<ILiveActivitySystemStatus>;
};
