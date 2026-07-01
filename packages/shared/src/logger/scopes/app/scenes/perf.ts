import { BaseScene } from '../../../base/baseScene';
import { LogToConsole, LogToLocal } from '../../../base/decorators';

let _renderStartAt = 0;

export function markRenderStart() {
  if (_renderStartAt === 0) {
    _renderStartAt = Date.now();
  }
}

export function getRenderElapsedMs(): number {
  return _renderStartAt > 0 ? Date.now() - _renderStartAt : 0;
}

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

  @LogToLocal()
  public renderPhase(params: { name: string; elapsedMs: number }) {
    return params;
  }

  @LogToLocal()
  public profilerRender(params: {
    id: string;
    phase: string;
    actualDuration: number;
    baseDuration: number;
    renderCount: number;
    totalActualDuration: number;
    elapsedMs: number;
  }) {
    return params;
  }

  @LogToLocal()
  public tabPreloadStrategy(tier: string) {
    return { tier };
  }

  @LogToLocal()
  public tabPageMounted(routeName: string) {
    return { routeName };
  }

  @LogToLocal()
  public tabPreloadMount(routeName: string) {
    return { routeName };
  }

  @LogToLocal()
  public deviceTierDetected(params: {
    tier: string;
    source: 'cache' | 'default' | 'calibration';
    data?: any;
  }) {
    return params;
  }
}
