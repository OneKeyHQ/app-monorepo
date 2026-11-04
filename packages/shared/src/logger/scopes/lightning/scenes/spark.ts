import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToLocalDevOnly } from '../../../base/decorators';

/**
 * Network trail of the Breez SDK behind Lightning Spark. Every SDK request is
 * either sent to an allowed upstream or blocked, and these entries show which,
 * so a failing connect or sync can be traced from the app log. Paths carry no
 * query string, and header values are never logged.
 */
export class SparkScene extends BaseScene {
  /** A request refused by the network policy; it never left the device. */
  @LogToLocal({ level: 'warn' })
  public requestBlocked(params: {
    method: string;
    host: string;
    path: string;
  }) {
    return params;
  }

  /** A request that failed: network error, HTTP error or gRPC error. */
  @LogToLocal({ level: 'warn' })
  public requestFailed(params: {
    method: string;
    upstream: string;
    path: string;
    status?: number;
    grpcStatus?: string;
    error?: string;
    durationMs: number;
  }) {
    return params;
  }

  /** Every request sent, in dev builds only. */
  @LogToLocalDevOnly({ level: 'info' })
  public requestSent(params: {
    method: string;
    upstream: string;
    path: string;
    status: number;
    durationMs: number;
  }) {
    return params;
  }

  /** A connect started by a Spark screen, not by the user, that failed. */
  @LogToLocal({ level: 'warn' })
  public autoConnectFailed(params: { error: string }) {
    return params;
  }

  /**
   * A payment the SDK reported as completed that does not prove it: no
   * preimage of the invoice's payment hash. Carries no invoice or preimage.
   */
  @LogToLocal({ level: 'error' })
  public paymentNotVerified(params: { paymentId: string; reason: string }) {
    return params;
  }

  /** A warning the Breez SDK logged itself. */
  @LogToLocal({ level: 'warn' })
  public sdkWarning(params: { line: string }) {
    return params;
  }

  /** An error the Breez SDK logged itself. */
  @LogToLocal({ level: 'error' })
  public sdkError(params: { line: string }) {
    return params;
  }
}
