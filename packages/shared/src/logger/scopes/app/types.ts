export type IApiAvailabilityResultParams = {
  durationMs: number;
  errorCode: string;
  httpStatusCode: number;
  method:
    | 'DELETE'
    | 'GET'
    | 'HEAD'
    | 'OPTIONS'
    | 'OTHER'
    | 'PATCH'
    | 'POST'
    | 'PUT';
  responseCode: string;
  routeGroup: string;
  sampleRate: number;
  service: string;
  status:
    | 'api_error'
    | 'cancelled'
    | 'http_error'
    | 'network_error'
    | 'success'
    | 'timeout';
};

export type IWebSocketAvailabilityTransport = 'notification_market' | 'perps';

export type IWebSocketConnectionTrigger = 'initial' | 'reconnect';

export type IWebSocketConnectionAttemptParams = {
  attemptId: string;
  transport: IWebSocketAvailabilityTransport;
  trigger: IWebSocketConnectionTrigger;
};

export type IWebSocketConnectionResultParams =
  IWebSocketConnectionAttemptParams & {
    durationMs: number;
    errorCode: string;
    status: 'failed' | 'success' | 'timeout';
  };

export type IWebSocketConnectionClosedParams = {
  connectedDurationMs: number;
  reason:
    | 'client_disconnect'
    | 'ping_timeout'
    | 'server_disconnect'
    | 'transport_close'
    | 'transport_error'
    | 'unknown';
  transport: IWebSocketAvailabilityTransport;
  willReconnect: boolean;
};

export type IWebViewAvailabilityResultParams = {
  attemptId: string;
  durationMs: number;
  errorCode: string;
  sampleRate: number;
  service: string;
  status:
    | 'cancelled'
    | 'http_error'
    | 'network_error'
    | 'render_process_gone'
    | 'success'
    | 'timeout';
};
