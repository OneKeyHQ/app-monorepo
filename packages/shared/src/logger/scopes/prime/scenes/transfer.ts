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
  }: {
    message: string | undefined;
    type: string | undefined;
    description: string | undefined;
    transport: string | undefined;
    attempt: number;
    withinGracePeriod: boolean;
    elapsedMs: number;
  }) {
    return {
      message,
      type,
      description,
      transport,
      attempt,
      withinGracePeriod,
      elapsedMs,
    };
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
