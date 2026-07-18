import {
  PERFORMANCE_JOURNEY_TIMEOUTS,
  PerformanceJourneyManager,
} from '@onekeyhq/shared/src/performance/journey';
import type { IPerformanceJourneyTerminalInfo } from '@onekeyhq/shared/src/performance/journey';
import {
  logPerformanceJourneyTerminalLocal,
  reportPerformanceTerminal,
} from '@onekeyhq/shared/src/performance/terminalReporter';

export type IHomePerfCacheState = 'hit' | 'miss' | 'stale' | 'unknown';
export type IHomePerfContentClass =
  | 'normal'
  | 'heavy'
  | 'authoritative_empty'
  | 'unbacked'
  | 'no_wallet';
type IHomePerfScenario = 'cold' | 'warm_reentry' | 'scope_switch' | 'refresh';
type IHomePerfNetworkScope = 'all_networks' | 'single_network';

type IHomePerfContext = {
  cacheState: IHomePerfCacheState;
  contentClass: IHomePerfContentClass;
  networkScope: IHomePerfNetworkScope;
  scenario: IHomePerfScenario;
};

type IHomePerfReporter = (
  eventName: 'homePerfReady' | 'homePerfRefreshSettled',
  payload: Record<string, unknown>,
) => void;

export function isHomeAuthoritativeReady({
  dataCandidateReady,
  scopeReady,
  shellInteractive,
  temporaryEmpty,
}: {
  dataCandidateReady: boolean;
  scopeReady: boolean;
  shellInteractive: boolean;
  temporaryEmpty: boolean;
}) {
  return (
    scopeReady && shellInteractive && dataCandidateReady && !temporaryEmpty
  );
}

function scheduleAfterStableFrames(callback: () => void) {
  let secondFrame: number | undefined;
  let stableTimer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;

  const requestFrame = (frameCallback: () => void) => {
    if (typeof requestAnimationFrame === 'function') {
      return requestAnimationFrame(frameCallback);
    }
    return setTimeout(frameCallback, 0) as unknown as number;
  };
  const cancelFrame = (frame: number | undefined) => {
    if (frame === undefined) return;
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(frame);
    } else {
      clearTimeout(frame);
    }
  };

  const firstFrame = requestFrame(() => {
    secondFrame = requestFrame(() => {
      stableTimer = setTimeout(() => {
        if (!cancelled) callback();
      }, 300);
    });
  });

  return () => {
    cancelled = true;
    cancelFrame(firstFrame);
    cancelFrame(secondFrame);
    if (stableTimer !== undefined) clearTimeout(stableTimer);
  };
}

export class HomePerformanceMonitor {
  private readonly readyManager = new PerformanceJourneyManager();

  private readonly refreshManager = new PerformanceJourneyManager();

  private readonly reporter: IHomePerfReporter;

  private didEnter = false;

  private activeScopeKey?: string;

  private readyContext?: IHomePerfContext;

  private hasScope = false;

  private hasDataCandidate = false;

  private shellInteractive = false;

  private stableCleanup?: () => void;

  private refreshSettleCleanup?: () => void;

  constructor(reporter: IHomePerfReporter = reportPerformanceTerminal) {
    this.reporter = reporter;
  }

  enter() {
    const scenario: IHomePerfScenario = this.didEnter ? 'warm_reentry' : 'cold';
    this.didEnter = true;
    this.startReadyJourney(scenario);
  }

  leave() {
    this.stableCleanup?.();
    this.stableCleanup = undefined;
    this.readyManager.cancelCurrent();
  }

  scopeReady({
    networkScope,
    scopeKey,
  }: {
    networkScope: IHomePerfNetworkScope;
    scopeKey: string;
  }) {
    if (!scopeKey) return;
    if (!this.readyManager.getCurrent()) {
      this.startReadyJourney(this.didEnter ? 'warm_reentry' : 'cold');
      this.didEnter = true;
    }
    if (this.activeScopeKey && this.activeScopeKey !== scopeKey) {
      this.startReadyJourney('scope_switch');
    }
    this.activeScopeKey = scopeKey;
    this.hasScope = true;
    if (this.readyContext) this.readyContext.networkScope = networkScope;
    this.readyManager.getCurrent()?.mark('scope_ready');
    this.maybeScheduleReady();
  }

  dataCandidate({
    cacheState,
    contentClass,
    snapshotApplied = false,
  }: {
    cacheState: IHomePerfCacheState;
    contentClass: IHomePerfContentClass;
    snapshotApplied?: boolean;
  }) {
    const journey = this.readyManager.getCurrent();
    if (!journey || journey.isTerminal) return;
    this.hasDataCandidate = true;
    if (this.readyContext) {
      this.readyContext.cacheState = cacheState;
      this.readyContext.contentClass = contentClass;
    }
    journey.mark('data_candidate');
    if (snapshotApplied) journey.mark('snapshot_applied');
    this.maybeScheduleReady();
  }

  setShellInteractive(interactive: boolean) {
    this.shellInteractive = interactive;
    if (!interactive) {
      this.stableCleanup?.();
      this.stableCleanup = undefined;
      return;
    }
    this.maybeScheduleReady();
  }

  startRefresh(context?: Partial<IHomePerfContext>) {
    this.refreshSettleCleanup?.();
    this.refreshSettleCleanup = undefined;
    const refreshContext: IHomePerfContext = {
      cacheState:
        context?.cacheState ?? this.readyContext?.cacheState ?? 'unknown',
      contentClass:
        context?.contentClass ?? this.readyContext?.contentClass ?? 'normal',
      networkScope:
        context?.networkScope ??
        this.readyContext?.networkScope ??
        'single_network',
      scenario: 'refresh',
    };
    const journey = this.refreshManager.start({
      markPrefix: 'HomePerf',
      timeoutMs: PERFORMANCE_JOURNEY_TIMEOUTS.home,
      onTerminal: (info) =>
        this.reportTerminal('homePerfRefreshSettled', info, refreshContext),
    });
    journey.mark('enter');
  }

  refreshActivity(isRefreshing: boolean) {
    const journey = this.refreshManager.getCurrent();
    if (!journey || journey.isTerminal || isRefreshing) {
      this.refreshSettleCleanup?.();
      this.refreshSettleCleanup = undefined;
      return;
    }
    const generation = journey.generation;
    const timer = setTimeout(() => {
      if (
        this.refreshManager.isCurrent(journey) &&
        journey.generation === generation
      ) {
        journey.mark('refresh_settled');
        journey.succeed();
      }
    }, 300);
    this.refreshSettleCleanup = () => clearTimeout(timer);
    journey.addCleanup(this.refreshSettleCleanup);
  }

  private startReadyJourney(scenario: IHomePerfScenario) {
    this.stableCleanup?.();
    this.stableCleanup = undefined;
    this.hasScope = false;
    this.hasDataCandidate = false;
    this.shellInteractive = false;
    const context: IHomePerfContext = {
      cacheState: 'unknown',
      contentClass: 'normal',
      networkScope: 'single_network',
      scenario,
    };
    this.readyContext = context;
    const journey = this.readyManager.start({
      markPrefix: 'HomePerf',
      timeoutMs: PERFORMANCE_JOURNEY_TIMEOUTS.home,
      onTerminal: (info) => this.reportTerminal('homePerfReady', info, context),
    });
    journey.mark('enter');
  }

  private maybeScheduleReady() {
    const journey = this.readyManager.getCurrent();
    if (
      !journey ||
      this.stableCleanup ||
      !isHomeAuthoritativeReady({
        dataCandidateReady: this.hasDataCandidate,
        scopeReady: this.hasScope,
        shellInteractive: this.shellInteractive,
        temporaryEmpty: false,
      })
    ) {
      return;
    }
    const generation = journey.generation;
    this.stableCleanup = scheduleAfterStableFrames(() => {
      this.stableCleanup = undefined;
      if (
        this.readyManager.isCurrent(journey) &&
        journey.generation === generation &&
        this.hasScope &&
        this.hasDataCandidate &&
        this.shellInteractive
      ) {
        journey.mark('first_stable_interactive');
        journey.succeed();
      }
    });
    journey.addCleanup(() => {
      this.stableCleanup?.();
      this.stableCleanup = undefined;
    });
  }

  private reportTerminal(
    eventName: 'homePerfReady' | 'homePerfRefreshSettled',
    info: IPerformanceJourneyTerminalInfo,
    context: IHomePerfContext,
  ) {
    logPerformanceJourneyTerminalLocal(eventName, info);
    if (!info.sampled) return;
    const payload = {
      ...context,
      durationMs: info.durationMs,
      result: info.state,
      sampleRate: info.sampleRate,
      scopeReadyMs: info.stageDurations.scope_ready,
      dataCandidateMs: info.stageDurations.data_candidate,
      snapshotAppliedMs: info.stageDurations.snapshot_applied,
      renderer: 'legacy',
      errorCode: info.state === 'timeout' ? 'timeout' : undefined,
    };
    this.reporter(eventName, payload);
  }
}

export const homePerformance = new HomePerformanceMonitor();
