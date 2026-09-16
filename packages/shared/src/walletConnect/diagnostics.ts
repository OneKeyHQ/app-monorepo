export type IWalletConnectDiagnosticLevel = 'info' | 'error';

export type IWalletConnectDappConnectionProgress = {
  attemptId?: number;
  attempt: number;
  lastFailedAttempt: number;
  connected?: boolean;
  connectedDuringAttempt: boolean;
  snapshotFailed: boolean;
  relayUrl: string;
};

export type IWalletConnectDiagnosticEvent = {
  sequence: number;
  timestamp: number;
  stage: 'connection' | 'relay' | 'session' | 'request';
  event: string;
  level: IWalletConnectDiagnosticLevel;
  requestId?: number;
  topic?: string;
  method?: string;
  chainId?: string;
  errorCode?: number;
  errorCategory?: string;
  previousRelayUrl?: string;
  relayUrl?: string;
};

export type IWalletConnectDiagnosticSession = {
  topic?: string;
  expiresAt: number;
  acknowledged: boolean;
  subscribed: boolean;
  subscriptionPending: boolean;
  chains: string[];
  methods: string[];
};

export type IWalletConnectDiagnosticRequest = {
  requestId?: number;
  topic?: string;
  method?: string;
  chainId?: string;
  receivedAt?: number;
  expiresAt?: number;
};

export type IWalletConnectDiagnostics = {
  capturedAt: number;
  startedAt: number;
  initialization: 'idle' | 'initializing' | 'ready' | 'failed';
  listenersRegistered: boolean;
  connectionAttempts: number;
  lastFailedConnectionAttempt: number;
  reconnectAttempts: number;
  connectionSuccesses: number;
  disconnections: number;
  relaySwitches: number;
  relaySwitchPending: boolean;
  relayUrl: string;
  connected?: boolean;
  connecting?: boolean;
  providerConnecting?: boolean;
  hasSubscriptionTopics?: boolean;
  transportExplicitlyClosed?: boolean;
  subscriptions?: number;
  pendingSubscriptions?: number;
  pairings?: number;
  sessions?: number;
  pendingRequests?: number;
  sessionDetails: IWalletConnectDiagnosticSession[];
  pendingRequestDetails: IWalletConnectDiagnosticRequest[];
  detailLimit: number;
  snapshotFailed: boolean;
  lastRelayMessageAt?: number;
  lastSessionEventAt?: number;
  lastPublishAt?: number;
  lastConnectionErrorAt?: number;
  lastConnectedAt?: number;
  events: IWalletConnectDiagnosticEvent[];
  eventLimit: number;
};
