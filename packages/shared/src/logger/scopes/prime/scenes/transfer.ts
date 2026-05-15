import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class PrimeTransferScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public endpointResolved({
    endpoint,
    elapsedMs,
  }: {
    endpoint: string;
    elapsedMs: number;
  }) {
    return { endpoint, elapsedMs };
  }

  @LogToLocal({ level: 'info' })
  public initWebSocket({ endpoint }: { endpoint: string }) {
    return { endpoint };
  }

  // Page-side: usePromiseResult begins resolving the websocket endpoint.
  // Pair this log with pageEndpointResolveDone to measure endpoint resolution
  // cost (notably across the UI→BG RPC under split-thread).
  @LogToLocal({ level: 'info' })
  public pageEndpointResolveStart({
    runtimeKind,
    websocketEndpointUpdatedAt,
    isBotWalletExport,
  }: {
    runtimeKind: string | undefined;
    websocketEndpointUpdatedAt: number | undefined;
    isBotWalletExport: boolean;
  }) {
    return { runtimeKind, websocketEndpointUpdatedAt, isBotWalletExport };
  }

  @LogToLocal({ level: 'info' })
  public pageEndpointResolveDone({
    endpoint,
    elapsedMs,
    serverType,
    runtimeKind,
  }: {
    endpoint: string;
    elapsedMs: number;
    serverType: string | undefined;
    runtimeKind: string | undefined;
  }) {
    return { endpoint, elapsedMs, serverType, runtimeKind };
  }

  // Page-side: the useEffect that calls initWebSocket has just fired. Log the
  // dep snapshot so we can identify which dependency caused the re-run when a
  // surprise reconnect happens without a manual Refresh tap.
  @LogToLocal({ level: 'info' })
  public pageInitEffectFired({
    endpoint,
    hasEndpoint,
    serverType,
    isBotWalletExport,
    websocketEndpointUpdatedAt,
    runtimeKind,
    isBackgroundThreadReady,
  }: {
    endpoint: string | undefined;
    hasEndpoint: boolean;
    serverType: string | undefined;
    isBotWalletExport: boolean;
    websocketEndpointUpdatedAt: number | undefined;
    runtimeKind: string | undefined;
    isBackgroundThreadReady: boolean;
  }) {
    return {
      endpoint,
      hasEndpoint,
      serverType,
      isBotWalletExport,
      websocketEndpointUpdatedAt,
      runtimeKind,
      isBackgroundThreadReady,
    };
  }

  // BG-side: initWebSocket has just entered (still inside mutex). Captures the
  // smoking-gun question for split-thread: how soon after the background
  // Hermes entry did this RPC arrive, and was a previous socket still around?
  @LogToLocal({ level: 'info' })
  public initWebSocketContext({
    endpoint,
    runtimeKind,
    enableNativeBackgroundThread,
    sinceBgEntryMs,
    prevSocketExists,
  }: {
    endpoint: string;
    runtimeKind: string | undefined;
    enableNativeBackgroundThread: boolean;
    sinceBgEntryMs: number | undefined;
    prevSocketExists: boolean;
  }) {
    return {
      endpoint,
      runtimeKind,
      enableNativeBackgroundThread,
      sinceBgEntryMs,
      prevSocketExists,
    };
  }

  // BG-side: right before invoking io(endpoint, …). Mirrors the exact config
  // socket.io is given so logs alone can answer "what retry budget did this
  // run actually start with."
  @LogToLocal({ level: 'info' })
  public socketIoFactoryCalled({
    endpoint,
    transports,
    timeout,
    reconnectionAttempts,
    reconnectionDelay,
    reconnectionDelayMax,
    sinceInitMs,
  }: {
    endpoint: string;
    transports: string[];
    timeout: number;
    reconnectionAttempts: number;
    reconnectionDelay: number;
    reconnectionDelayMax: number;
    sinceInitMs: number;
  }) {
    return {
      endpoint,
      transports,
      timeout,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax,
      sinceInitMs,
    };
  }

  // Fired exactly once per init when `withinGracePeriod` flips false (i.e. the
  // UI is about to surface the red "failed" banner). Tells us _why_ it flipped
  // (timer vs attempt budget).
  @LogToLocal({ level: 'warn' })
  public gracePeriodExpired({
    reason,
    elapsedMs,
    connectErrorCount,
    gracePeriodMs,
    reconnectionAttempts,
  }: {
    reason: 'elapsedMs' | 'connectErrorCount';
    elapsedMs: number;
    connectErrorCount: number;
    gracePeriodMs: number;
    reconnectionAttempts: number;
  }) {
    return {
      reason,
      elapsedMs,
      connectErrorCount,
      gracePeriodMs,
      reconnectionAttempts,
    };
  }

  // Records every bump of primeTransferAtom.websocketEndpointUpdatedAt so we
  // can attribute the page's useEffect re-runs to a concrete caller (manual
  // Refresh vs custom-server save vs anything else added later).
  @LogToLocal({ level: 'info' })
  public endpointTimestampBumped({
    caller,
    newTs,
  }: {
    caller: string;
    newTs: number;
  }) {
    return { caller, newTs };
  }

  @LogToLocal({ level: 'info' })
  public socketConnect({
    transport,
    elapsedMs,
  }: {
    transport: string | undefined;
    elapsedMs: number;
  }) {
    return { transport, elapsedMs };
  }

  @LogToLocal({ level: 'warn' })
  public socketConnectError({
    message,
    type,
    description,
    transport,
    attempt,
    withinGracePeriod,
    elapsedMs,
    sinceLastErrorMs,
    sinceFactoryMs,
    errorName,
    errorKeys,
    hasCause,
  }: {
    message: string | undefined;
    type: string | undefined;
    description: string | undefined;
    transport: string | undefined;
    attempt: number;
    withinGracePeriod: boolean;
    elapsedMs: number;
    sinceLastErrorMs: number | undefined;
    sinceFactoryMs: number;
    errorName: string | undefined;
    errorKeys: string[] | undefined;
    hasCause: boolean;
  }) {
    return {
      message,
      type,
      description,
      transport,
      attempt,
      withinGracePeriod,
      elapsedMs,
      sinceLastErrorMs,
      sinceFactoryMs,
      errorName,
      errorKeys,
      hasCause,
    };
  }

  // Cheap isolation experiment: a plain HTTPS GET of `${endpoint}/health`
  // runs at the same time as socket.io. If main-thread HTTP succeeds but
  // BG-thread HTTP or socket.io fails, the bug is bg-thread-specific
  // networking — not the server.
  @LogToLocal({ level: 'info' })
  public uiHealthCheck({
    status,
    elapsedMs,
    error,
    runtimeKind,
  }: {
    status: number | undefined;
    elapsedMs: number;
    error: string | undefined;
    runtimeKind: string | undefined;
  }) {
    return { status, elapsedMs, error, runtimeKind };
  }

  @LogToLocal({ level: 'info' })
  public bgHealthCheckProbe({
    status,
    elapsedMs,
    error,
    runtimeKind,
  }: {
    status: number | undefined;
    elapsedMs: number;
    error: string | undefined;
    runtimeKind: string | undefined;
  }) {
    return { status, elapsedMs, error, runtimeKind };
  }

  // Manager-level events: catch the case where polling connects but the
  // websocket upgrade itself fails, which would otherwise look like a normal
  // disconnect→reconnect in the existing logs.
  @LogToLocal({ level: 'info' })
  public socketUpgrade({
    transport,
    elapsedMs,
  }: {
    transport: string | undefined;
    elapsedMs: number;
  }) {
    return { transport, elapsedMs };
  }

  @LogToLocal({ level: 'warn' })
  public socketUpgradeError({
    message,
    transport,
    elapsedMs,
  }: {
    message: string | undefined;
    transport: string | undefined;
    elapsedMs: number;
  }) {
    return { message, transport, elapsedMs };
  }

  @LogToLocal({ level: 'warn' })
  public socketManagerError({
    message,
    errorName,
    elapsedMs,
  }: {
    message: string | undefined;
    errorName: string | undefined;
    elapsedMs: number;
  }) {
    return { message, errorName, elapsedMs };
  }

  @LogToLocal({ level: 'info' })
  public socketReconnectAttempt({ attempt }: { attempt: number }) {
    return { attempt };
  }

  @LogToLocal({ level: 'info' })
  public socketReconnect({ attempt }: { attempt: number }) {
    return { attempt };
  }

  @LogToLocal({ level: 'error' })
  public socketReconnectFailed({
    attempts,
    elapsedMs,
  }: {
    attempts: number;
    elapsedMs: number;
  }) {
    return { attempts, elapsedMs };
  }

  @LogToLocal({ level: 'info' })
  public socketDisconnect({ reason }: { reason: string | undefined }) {
    return { reason };
  }

  @LogToLocal({ level: 'info' })
  public disconnectWebSocket({ caller }: { caller: string }) {
    return { caller };
  }

  @LogToLocal({ level: 'error' })
  public disconnectError({ stage, error }: { stage: string; error: string }) {
    return { stage, error };
  }

  // engine.io handshake response from the server. The server is the
  // authoritative source for pingInterval / pingTimeout — both threads (main
  // vs background) MUST receive the same values here. If they differ, the
  // problem is at the polling response layer; if they match, the timer fires
  // for a reason other than "wrong configured value."
  @LogToLocal({ level: 'info' })
  public engineHandshake({
    source,
    sid,
    pingInterval,
    pingTimeout,
    upgrades,
    maxPayload,
    transport,
  }: {
    source: 'manager-open' | 'engine-handshake';
    sid: string | undefined;
    pingInterval: number | undefined;
    pingTimeout: number | undefined;
    upgrades: string[] | undefined;
    maxPayload: number | undefined;
    transport: string | undefined;
  }) {
    return {
      source,
      sid,
      pingInterval,
      pingTimeout,
      upgrades,
      maxPayload,
      transport,
    };
  }

  // Every packet that the engine.io layer RECEIVES. Engine packet types are
  // numeric: 0=open, 1=close, 2=ping, 3=pong, 4=message, 5=upgrade, 6=noop.
  // Decoded names are emitted as strings so logs are scannable. If we never
  // see type=2 (ping) it means server-side ping is not reaching the client
  // — hypothesis A. If we see ping but no outgoing pong, hypothesis B.
  @LogToLocal({ level: 'info' })
  public enginePacketIn({
    type,
    dataLength,
    sinceConnectMs,
    sinceLastPacketInMs,
  }: {
    type: string | undefined;
    dataLength: number | undefined;
    sinceConnectMs: number;
    sinceLastPacketInMs: number | undefined;
  }) {
    return { type, dataLength, sinceConnectMs, sinceLastPacketInMs };
  }

  // Every packet the engine.io layer is ABOUT TO SEND (packetCreate). Pong
  // (type=3) responses to server pings are auto-created by engine.io's
  // heartbeat path. If a ping arrives in enginePacketIn but no matching pong
  // appears in enginePacketOut, the client knows about the ping but cannot
  // write the response — hypothesis B (bg-thread XHR can't POST in time).
  @LogToLocal({ level: 'info' })
  public enginePacketOut({
    type,
    dataLength,
    sinceConnectMs,
  }: {
    type: string | undefined;
    dataLength: number | undefined;
    sinceConnectMs: number;
  }) {
    return { type, dataLength, sinceConnectMs };
  }

  // Manager-level 'ping' event — fired on socket.io v4 Manager when the
  // client has just received a server ping (and is about to auto-pong).
  // Cross-checks enginePacketIn(type=ping); also gives a clean cadence view.
  @LogToLocal({ level: 'info' })
  public managerPing({
    sinceConnectMs,
    sinceLastPingMs,
  }: {
    sinceConnectMs: number;
    sinceLastPingMs: number | undefined;
  }) {
    return { sinceConnectMs, sinceLastPingMs };
  }

  // Verification probe for the "setTimeout fires too early on bg Hermes"
  // hypothesis. Each call schedules setTimeout(fn, scheduledDelayMs) at a
  // known moment and reports the actual wall-clock elapsed when the
  // callback fires. On a healthy timer infrastructure actualElapsedMs is
  // within ±50ms of scheduledDelayMs; if it's an order of magnitude
  // smaller, the timer is firing prematurely. Run from both main and bg
  // runtimes so the two can be compared head-to-head.
  @LogToLocal({ level: 'info' })
  public timerSanityCheck({
    scheduledDelayMs,
    actualElapsedMs,
    runtimeKind,
    enableNativeBackgroundThread,
  }: {
    scheduledDelayMs: number;
    actualElapsedMs: number;
    runtimeKind: string | undefined;
    enableNativeBackgroundThread: boolean;
  }) {
    return {
      scheduledDelayMs,
      actualElapsedMs,
      runtimeKind,
      enableNativeBackgroundThread,
    };
  }
}
