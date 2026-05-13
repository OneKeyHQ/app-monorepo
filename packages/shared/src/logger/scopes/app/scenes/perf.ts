import { BaseScene } from '../../../base/baseScene';
import { LogToConsole, LogToLocal } from '../../../base/decorators';

export class AppPerfScene extends BaseScene {
  @LogToConsole()
  public logTime(params: { message: string; data?: any }) {
    return [params];
  }

  @LogToLocal()
  public longTask(params: {
    durationMs: number;
    name?: string;
    stack?: string;
  }) {
    return [params];
  }

  @LogToLocal()
  public longTaskInitFailed(error: unknown) {
    return [
      {
        message: error instanceof Error ? error.message : String(error),
      },
    ];
  }

  @LogToLocal()
  public intervalCensus(params: {
    totalLive: number;
    bySource: { source: string; count: number }[];
  }) {
    return [params];
  }

  @LogToLocal()
  public cpuWatchdogFired(params: {
    reason:
      | 'sustained-high-cpu-severe'
      | 'sustained-high-cpu-mild'
      | 'unresponsive';
    pid?: number;
    cpuTrend?: number[];
    uptimeMs?: number;
  }) {
    return [params];
  }

  @LogToLocal()
  public defensiveTriggered(params: {
    source: string;
    reason: string;
    details?: Record<string, unknown>;
  }) {
    return [params];
  }
}
