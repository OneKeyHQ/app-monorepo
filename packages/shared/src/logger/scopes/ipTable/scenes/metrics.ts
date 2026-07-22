import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

/**
 * IP Table reliability metrics for server-side monitoring.
 *
 * These events exist so that endpoint failover behavior and config
 * verification failures are visible without asking users to upload logs
 * (the 2026-07-16 incident took a manual 11MB log upload to diagnose).
 *
 * No PII: only root domains, decision enums and short correlation hashes.
 */
export class IpTableMetricsScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public endpointSwitched(params: {
    domain: string;
    from: 'domain' | 'ip';
    to: 'domain' | 'ip';
    trigger: 'fast_failover' | 'speed_test';
    reason?: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public adapterFailover(params: {
    lookupDomain: string;
    action: 'activated' | 'deactivated';
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public configVerifyFailed(params: {
    reason: string;
    configVersion?: number;
    payloadHash?: string;
  }) {
    return params;
  }
}
