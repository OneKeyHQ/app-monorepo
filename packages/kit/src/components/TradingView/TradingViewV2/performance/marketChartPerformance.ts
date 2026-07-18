import {
  PERFORMANCE_JOURNEY_TIMEOUTS,
  PerformanceJourneyManager,
  getPerformanceNow,
} from '@onekeyhq/shared/src/performance/journey';
import type { IPerformanceJourneyTerminalInfo } from '@onekeyhq/shared/src/performance/journey';
import {
  type IPerformanceTerminalEventName,
  logPerformanceJourneyTerminalLocal,
  reportPerformanceTerminal,
} from '@onekeyhq/shared/src/performance/terminalReporter';

type IMarketChartScenario =
  | 'first_entry'
  | 'warm_reentry'
  | 'symbol_switch'
  | 'period_switch';
type IMarketChartSourceClass =
  | 'market_api'
  | 'hyperliquid'
  | 'fallback'
  | 'unknown';
type IMarketChartPage = 'market_detail' | 'swap_kline';

type IMarketChartContext = {
  errorCode?: string;
  expectedPeriod?: string;
  fallbackUsed: boolean;
  page: IMarketChartPage;
  priceScaleDoneAt?: number;
  priceScaleMs?: number;
  priceScaleStartedAt?: number;
  reloadCount: number;
  scenario: IMarketChartScenario;
  scopeKey: string;
  sourceClass: IMarketChartSourceClass;
};

export type IMarketChartJourneyToken = {
  generation: number;
  scopeKey: string;
};

type IMarketChartReporter = (
  eventName: IPerformanceTerminalEventName,
  payload: Record<string, unknown>,
) => void;

export class MarketChartPerformanceMonitor {
  private readonly manager = new PerformanceJourneyManager();

  private readonly page: IMarketChartPage;

  private readonly reporter: IMarketChartReporter;

  private didEnter = false;

  private activeScopeKey?: string;

  private context?: IMarketChartContext;

  constructor({
    page,
    reporter = reportPerformanceTerminal,
  }: {
    page: IMarketChartPage;
    reporter?: IMarketChartReporter;
  }) {
    this.page = page;
    this.reporter = reporter;
  }

  routeStart(scopeKey: string) {
    if (!scopeKey) return undefined;
    const current = this.manager.getCurrent();
    if (current && this.activeScopeKey === scopeKey) {
      return this.getToken();
    }
    let scenario: IMarketChartScenario = 'warm_reentry';
    if (!this.didEnter) {
      scenario = 'first_entry';
    } else if (this.activeScopeKey && this.activeScopeKey !== scopeKey) {
      scenario = 'symbol_switch';
    }
    this.didEnter = true;
    this.activeScopeKey = scopeKey;
    return this.startJourney(scopeKey, scenario);
  }

  paramsReady(scopeKey: string) {
    const token =
      this.activeScopeKey === scopeKey && this.manager.getCurrent()
        ? this.getToken()
        : this.routeStart(scopeKey);
    const journey = this.getJourney(token);
    journey?.mark('chart_params_ready');
    return token;
  }

  hostRequested(token: IMarketChartJourneyToken | undefined) {
    const journey = this.getJourney(token);
    if (!journey || !this.context) return;
    if (journey.getStageDuration('host_requested') !== undefined) {
      this.context.reloadCount += 1;
    }
    journey.mark('host_requested');
  }

  hostLoaded(token: IMarketChartJourneyToken | undefined) {
    this.getJourney(token)?.mark('host_loaded');
  }

  hostError(token: IMarketChartJourneyToken | undefined) {
    this.fail(token, 'host_load_failed');
  }

  dataRequestStart(token: IMarketChartJourneyToken | undefined) {
    this.getJourney(token)?.mark('data_request_start');
  }

  firstBarReady(token: IMarketChartJourneyToken | undefined, period: string) {
    const journey = this.getJourney(token);
    if (!journey || !this.context) return false;
    if (
      this.context.scenario === 'period_switch' &&
      this.context.expectedPeriod !== period
    ) {
      return false;
    }
    journey.mark('first_bar_ready');
    if (this.context.scenario === 'symbol_switch') {
      // The callback is emitted only after non-empty data for the new scope.
      journey.mark('symbol_change_done');
    }
    return journey.succeed();
  }

  periodChange(token: IMarketChartJourneyToken | undefined, toPeriod: string) {
    const current = this.manager.getCurrent();
    if (current && token?.generation !== current.generation) {
      return token;
    }
    const scopeKey = token?.scopeKey ?? this.activeScopeKey;
    if (!scopeKey || scopeKey !== this.activeScopeKey) return token;
    return this.startJourney(scopeKey, 'period_switch', toPeriod);
  }

  kLineError(
    token: IMarketChartJourneyToken | undefined,
    status: 'empty' | 'failed',
  ) {
    this.fail(token, status === 'empty' ? 'kline_empty' : 'kline_failed');
  }

  sourceChanged(
    token: IMarketChartJourneyToken | undefined,
    sourceClass: Exclude<IMarketChartSourceClass, 'fallback' | 'unknown'>,
  ) {
    if (this.getJourney(token) && this.context) {
      this.context.sourceClass = sourceClass;
    }
  }

  fallbackUsed(token: IMarketChartJourneyToken | undefined) {
    if (this.getJourney(token) && this.context) {
      this.context.fallbackUsed = true;
      this.context.sourceClass = 'fallback';
    }
  }

  priceScaleStart(token: IMarketChartJourneyToken | undefined) {
    const journey = this.getJourney(token);
    if (!journey || !this.context) return;
    this.context.priceScaleStartedAt = getPerformanceNow();
    this.context.priceScaleDoneAt = undefined;
    journey.mark('price_scale_start');
  }

  priceScaleDone(token: IMarketChartJourneyToken | undefined) {
    const journey = this.getJourney(token);
    if (!journey || this.context?.priceScaleStartedAt === undefined) {
      return;
    }
    this.context.priceScaleDoneAt = getPerformanceNow();
    this.context.priceScaleMs = Math.max(
      0,
      Math.round(
        this.context.priceScaleDoneAt - this.context.priceScaleStartedAt,
      ),
    );
    journey.mark('price_scale_done');
  }

  leave() {
    this.manager.cancelCurrent();
  }

  hasActiveJourney() {
    return Boolean(this.manager.getCurrent());
  }

  private startJourney(
    scopeKey: string,
    scenario: IMarketChartScenario,
    expectedPeriod?: string,
  ) {
    const context: IMarketChartContext = {
      expectedPeriod,
      fallbackUsed: false,
      page: this.page,
      reloadCount: 0,
      scenario,
      scopeKey,
      sourceClass: 'unknown',
    };
    this.context = context;
    const journey = this.manager.start({
      markPrefix: 'MarketPerf',
      timeoutMs: PERFORMANCE_JOURNEY_TIMEOUTS.market,
      onTerminal: (info) => this.reportTerminal(info, context),
    });
    journey.mark('route_start');
    if (scenario === 'symbol_switch') journey.mark('symbol_change_start');
    return { generation: journey.generation, scopeKey };
  }

  private getToken(): IMarketChartJourneyToken | undefined {
    const journey = this.manager.getCurrent();
    return journey && this.activeScopeKey
      ? { generation: journey.generation, scopeKey: this.activeScopeKey }
      : undefined;
  }

  private getJourney(token: IMarketChartJourneyToken | undefined) {
    const journey = this.manager.getCurrent();
    return journey &&
      token?.generation === journey.generation &&
      token.scopeKey === this.activeScopeKey
      ? journey
      : undefined;
  }

  private fail(token: IMarketChartJourneyToken | undefined, errorCode: string) {
    const journey = this.getJourney(token);
    if (!journey || !this.context) return false;
    this.context.errorCode = errorCode;
    return journey.error();
  }

  private reportTerminal(
    info: IPerformanceJourneyTerminalInfo,
    context: IMarketChartContext,
  ) {
    const isFailure = info.state === 'error' || info.state === 'timeout';
    let eventName: IPerformanceTerminalEventName = 'marketChartPerfReady';
    if (isFailure) {
      eventName = 'marketChartPerfError';
    } else if (context.scenario === 'symbol_switch') {
      eventName = 'marketChartPerfSymbolSwitch';
    }
    logPerformanceJourneyTerminalLocal(eventName, info);
    if (!info.sampled) return;

    const priceScalePending =
      context.priceScaleStartedAt !== undefined &&
      context.priceScaleDoneAt === undefined;
    let errorCode = context.errorCode;
    if (!errorCode && info.state === 'timeout') {
      errorCode = priceScalePending ? 'price_scale_timeout' : 'timeout';
    }
    this.reporter(eventName, {
      page: context.page,
      scenario: context.scenario,
      renderer: 'full_tv',
      sourceClass: context.sourceClass,
      durationMs: info.durationMs,
      paramsReadyMs: info.stageDurations.chart_params_ready,
      hostRequestedMs: info.stageDurations.host_requested,
      hostLoadedMs: info.stageDurations.host_loaded,
      priceScaleMs: context.priceScaleMs,
      firstBarMs: info.stageDurations.first_bar_ready,
      reloadCount: context.reloadCount,
      fallbackUsed: context.fallbackUsed,
      result: info.state,
      errorCode,
      sampleRate: info.sampleRate,
    });
  }
}

export const marketDetailChartPerformance = new MarketChartPerformanceMonitor({
  page: 'market_detail',
});

export const swapKLineChartPerformance = new MarketChartPerformanceMonitor({
  page: 'swap_kline',
});
