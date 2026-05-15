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
}
