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
  networkId?: string;
  isNative?: boolean;
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
  isPushTest?: boolean;
};

export type ILiveActivityStrings = {
  done: string;
  failed: string;
  refunded: string;
  canceled: string;
  refunding: string;
  almostDone: string;
  confirmingFrom: string;
  confirmingTo: string;
  pending: string;
  swapFailed: string;
  etaTemplate: string;
  lastUpdated: string;
  lastUpdatedLabel?: string;
  locale?: string;
  refundFailed?: string;
  expired?: string;
  partiallyFilled?: string;
};

// Minimal App-to-native request. The native manager derives presentation fields.
export type ILiveActivityContent = {
  status: ILiveActivityStatus;
  failureDetail?: 'expired' | 'refundFailed';
  updatedAtMs: number;
  revision: number;
  strings?: ILiveActivityStrings;
};

// Presentation fields for an ActivityKit state created by the App.
export type ILiveActivityPushContent = ILiveActivityContent & {
  displayPhase: 'eta' | 'ring';
  etaMinutes: number;
  almostDone: boolean;
  imageRevision?: number;
  progressStoppedAtMs?: number;
  // Remote updates must preserve the first terminal timestamp across updates.
  terminalAtMs?: number;
};

export type ILiveActivitySnapshot = {
  order: ILiveActivityOrder;
  content: ILiveActivityContent;
};

export type ILiveActivityIconUrls = { from?: string; to?: string };

export type ILiveActivityIconPrefetchRequest = {
  urls: ILiveActivityIconUrls;
  activityId?: string;
};

export type ILiveActivityStartRequest = ILiveActivitySnapshot & {
  iconUrls?: ILiveActivityIconUrls;
  supportsBtcReceivingPush?: boolean;
};

export type ILiveActivityPushFailureFallback = {
  activityId: string;
  reason: 'jpushFailed' | 'subscriptionRejected';
};

export type ILiveActivityUpdateRequest = ILiveActivitySnapshot & {
  // Retain the original bridge key for JS updates running on older native shells.
  terminalFallback?: ILiveActivityPushFailureFallback;
};

export type ILiveActivityInstance = Omit<ILiveActivitySnapshot, 'content'> & {
  content: Pick<ILiveActivityPushContent, 'status'> &
    Partial<Omit<ILiveActivityPushContent, 'status'>>;
  activityId: string;
  activityState: string;
  pushRegistration: 'notRequested' | 'pending' | 'registered' | 'failed';
  needsIconUrls?: boolean;
  ownershipStatus?: 'needsConfirmation';
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
};

export type ILiveActivitySubscriptionResult = {
  status: 'registered' | 'mocked';
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
    signal?: AbortSignal;
  }) => Promise<boolean>;
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
    snapshot: ILiveActivityStartRequest,
  ) => Promise<ILiveActivitySystemStatus>;
  prefetchIcons: (request: ILiveActivityIconPrefetchRequest) => Promise<void>;
  update: (
    snapshot: ILiveActivityUpdateRequest,
  ) => Promise<ILiveActivitySystemStatus>;
  updateStrings: (request: {
    orderKey: string;
    revision?: number;
    strings: ILiveActivityStrings;
  }) => Promise<ILiveActivitySystemStatus>;
  end: (orderKey: string) => Promise<ILiveActivitySystemStatus>;
  clearTracking: () => Promise<ILiveActivitySystemStatus>;
};
