import {
  PERFORMANCE_JOURNEY_TIMEOUTS,
  PerformanceJourneyManager,
} from '@onekeyhq/shared/src/performance/journey';
import type { IPerformanceJourneyTerminalInfo } from '@onekeyhq/shared/src/performance/journey';
import {
  type IPerformanceTerminalEventName,
  logPerformanceJourneyTerminalLocal,
  reportPerformanceTerminal,
} from '@onekeyhq/shared/src/performance/terminalReporter';

export type ISwapPerformanceQuoteMode = 'market' | 'limit' | 'stock';
type ISwapPerformanceScenario =
  | 'first_open'
  | 'amount_change'
  | 'token_change'
  | 'network_change'
  | 'manual_refresh';
type ISwapPerformanceResult =
  | 'success'
  | 'partial'
  | 'empty'
  | 'timeout'
  | 'error'
  | 'cancelled';

export type ISwapPerformanceIntent = {
  amountKey: string;
  fromNetworkKey: string;
  fromTokenKey: string;
  manualRefresh?: boolean;
  quoteKind: string;
  quoteMode: ISwapPerformanceQuoteMode;
  toNetworkKey: string;
  toTokenKey: string;
};

export type ISwapPerformanceRunId = string;

type ISwapPerformanceQuote = {
  actionable: boolean;
  providerKey: string;
};

type ISwapPerformanceContext = {
  errorCode?: string;
  eventId?: string;
  expectedProviderCount: number;
  firstResult?: ISwapPerformanceResult;
  intent: ISwapPerformanceIntent;
  intentKey: string;
  pageVisible: boolean;
  receivedProviderCount: number;
  receivedProviders: Set<string>;
  result?: ISwapPerformanceResult;
  runId: ISwapPerformanceRunId;
  scenario: ISwapPerformanceScenario;
  staleDiscardCount: number;
  successProviders: Set<string>;
};

type ISwapPerformanceReporter = (
  eventName: IPerformanceTerminalEventName,
  payload: Record<string, unknown>,
) => void;

function getNetworkKey(intent: ISwapPerformanceIntent) {
  return `${intent.fromNetworkKey}:${intent.toNetworkKey}`;
}

function getTokenKey(intent: ISwapPerformanceIntent) {
  return `${getNetworkKey(intent)}:${intent.fromTokenKey}:${intent.toTokenKey}`;
}

function createSwapPerformanceRunId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getSwapPerformanceIntentKey(intent: ISwapPerformanceIntent) {
  return `${getTokenKey(intent)}:${intent.amountKey}:${intent.quoteKind}:${intent.quoteMode}`;
}

export function getSwapPerformanceQuoteMode(
  protocol: string | undefined,
): ISwapPerformanceQuoteMode {
  const normalized = protocol?.toLowerCase();
  if (normalized === 'limit') return 'limit';
  if (normalized === 'stock') return 'stock';
  return 'market';
}

export function runSwapPerformanceSafely(callback: () => void) {
  try {
    callback();
  } catch {
    // Measurement must never change quote behavior.
  }
}

export class SwapPerformanceMonitor {
  private readonly pageManager = new PerformanceJourneyManager();

  private readonly firstQuoteManager = new PerformanceJourneyManager();

  private readonly settledManager = new PerformanceJourneyManager();

  private readonly reporter: ISwapPerformanceReporter;

  private pageVisible = true;

  private previousIntent?: ISwapPerformanceIntent;

  private context?: ISwapPerformanceContext;

  private readonly retiredEventIds = new Set<string>();

  constructor(reporter: ISwapPerformanceReporter = reportPerformanceTerminal) {
    this.reporter = reporter;
  }

  pageEnter(quoteMode: ISwapPerformanceQuoteMode) {
    if (this.pageManager.getCurrent()) return;
    const journey = this.pageManager.start({
      markPrefix: 'SwapPerf',
      timeoutMs: PERFORMANCE_JOURNEY_TIMEOUTS.swapQuote,
      onTerminal: (info) => {
        const eventName = 'swapPerfPageReady';
        logPerformanceJourneyTerminalLocal(eventName, info);
        if (!info.sampled) return;
        this.reporter(eventName, {
          scenario: 'first_open',
          quoteMode,
          durationMs: info.durationMs,
          pageVisible: this.pageVisible,
          result: info.state,
          errorCode: info.state === 'timeout' ? 'page_not_ready' : undefined,
          sampleRate: info.sampleRate,
        });
      },
    });
    journey.mark('page_enter');
  }

  pageReady() {
    const journey = this.pageManager.getCurrent();
    if (!journey) return false;
    journey.mark('page_ready');
    return journey.succeed();
  }

  pageLeave() {
    this.pageManager.cancelCurrent();
  }

  setPageVisible(pageVisible: boolean) {
    this.pageVisible = pageVisible;
  }

  beginIntent(intent: ISwapPerformanceIntent) {
    if (this.context?.eventId) {
      this.retiredEventIds.add(this.context.eventId);
      while (this.retiredEventIds.size > 20) {
        const first = this.retiredEventIds.values().next().value;
        if (!first) break;
        this.retiredEventIds.delete(first);
      }
    }
    const scenario = this.getScenario(intent);
    const context: ISwapPerformanceContext = {
      expectedProviderCount: 0,
      intent,
      intentKey: getSwapPerformanceIntentKey(intent),
      pageVisible: this.pageVisible,
      receivedProviderCount: 0,
      receivedProviders: new Set(),
      runId: createSwapPerformanceRunId(),
      scenario,
      staleDiscardCount: 0,
      successProviders: new Set(),
    };
    this.context = context;
    this.previousIntent = intent;

    const firstQuoteJourney = this.firstQuoteManager.start({
      markPrefix: 'SwapPerf',
      timeoutMs: PERFORMANCE_JOURNEY_TIMEOUTS.swapQuote,
      onTerminal: (info) =>
        this.reportQuoteTerminal('swapPerfFirstQuote', info, context),
    });
    const settledJourney = this.settledManager.start({
      markPrefix: 'SwapPerf',
      timeoutMs: PERFORMANCE_JOURNEY_TIMEOUTS.swapQuote,
      onTerminal: (info) =>
        this.reportQuoteTerminal('swapPerfQuoteSettled', info, context),
    });
    firstQuoteJourney.mark('quote_intent');
    settledJourney.mark('quote_intent');
    if (!context.pageVisible) {
      firstQuoteJourney.mark('hidden_refresh');
      settledJourney.mark('hidden_refresh');
    }
    return context.runId;
  }

  expectedProviders({
    eventId,
    intent,
    count,
    runId,
  }: {
    eventId: string;
    intent: ISwapPerformanceIntent;
    count: number;
    runId?: ISwapPerformanceRunId;
  }) {
    if (!eventId) {
      this.recordStaleDiscard();
      return false;
    }
    const context = this.acceptEvent(intent, eventId, runId);
    if (!context) return false;
    context.expectedProviderCount = Math.max(0, count);
    if (count === 0) {
      context.firstResult = 'empty';
      context.result = 'empty';
      this.firstQuoteManager.getCurrent()?.mark('quote_settled');
      this.settledManager.getCurrent()?.mark('quote_settled');
      this.firstQuoteManager.getCurrent()?.succeed();
      this.settledManager.getCurrent()?.succeed();
    } else if (context.receivedProviderCount >= count) {
      context.receivedProviderCount = count;
      this.finishSettled(context);
    }
    return true;
  }

  quotesReceived({
    eventId,
    expectedProviderCount,
    intent,
    quotes,
    runId,
  }: {
    eventId: string | undefined;
    expectedProviderCount?: number;
    intent: ISwapPerformanceIntent;
    quotes: ISwapPerformanceQuote[];
    runId?: ISwapPerformanceRunId;
  }) {
    if (!eventId) {
      this.recordStaleDiscard();
      return false;
    }
    const context = this.acceptEvent(intent, eventId, runId);
    if (!context) return false;
    if (expectedProviderCount !== undefined) {
      context.expectedProviderCount = Math.max(0, expectedProviderCount);
    }
    context.receivedProviderCount += quotes.length;
    if (context.expectedProviderCount > 0) {
      context.receivedProviderCount = Math.min(
        context.expectedProviderCount,
        context.receivedProviderCount,
      );
    }
    for (const quote of quotes) {
      if (quote.providerKey) {
        context.receivedProviders.add(quote.providerKey);
        if (quote.actionable) {
          context.successProviders.add(quote.providerKey);
        }
      }
    }
    if (
      context.successProviders.size > 0 &&
      this.firstQuoteManager.getCurrent()
    ) {
      context.firstResult = 'success';
      const journey = this.firstQuoteManager.getCurrent();
      journey?.mark('first_actionable_quote');
      journey?.succeed();
    }
    if (
      context.expectedProviderCount > 0 &&
      context.receivedProviderCount >= context.expectedProviderCount
    ) {
      this.finishSettled(context);
    }
    return true;
  }

  settled({
    eventId,
    intent,
    runId,
  }: {
    eventId?: string;
    intent: ISwapPerformanceIntent;
    runId?: ISwapPerformanceRunId;
  }) {
    const context = this.acceptEvent(intent, eventId, runId);
    if (!context) return false;
    if (
      context.expectedProviderCount <= 0 ||
      context.receivedProviderCount < context.expectedProviderCount
    ) {
      return false;
    }
    this.finishSettled(context);
    return true;
  }

  private finishSettled(context: ISwapPerformanceContext) {
    const successCount = context.successProviders.size;
    const receivedCount = context.receivedProviderCount;
    context.result = 'success';
    if (successCount === 0) {
      context.result = 'empty';
    } else if (
      successCount < receivedCount ||
      (context.expectedProviderCount > 0 &&
        successCount < context.expectedProviderCount)
    ) {
      context.result = 'partial';
    }
    if (this.firstQuoteManager.getCurrent()) {
      context.firstResult = context.result === 'success' ? 'success' : 'empty';
      this.firstQuoteManager.getCurrent()?.mark('quote_settled');
      this.firstQuoteManager.getCurrent()?.succeed();
    }
    const journey = this.settledManager.getCurrent();
    journey?.mark('quote_settled');
    journey?.succeed();
  }

  error({
    eventId,
    intent,
    runId,
  }: {
    eventId?: string;
    intent: ISwapPerformanceIntent;
    runId?: ISwapPerformanceRunId;
  }) {
    if (!eventId) {
      this.recordStaleDiscard();
      return false;
    }
    const context = this.acceptEvent(intent, eventId, runId);
    if (!context) return false;
    context.errorCode = 'quote_event_error';
    this.firstQuoteManager.getCurrent()?.error();
    this.settledManager.getCurrent()?.error();
    return true;
  }

  cancelIntent() {
    this.firstQuoteManager.cancelCurrent();
    this.settledManager.cancelCurrent();
  }

  private acceptEvent(
    intent: ISwapPerformanceIntent,
    eventId: string | undefined,
    runId: ISwapPerformanceRunId | undefined,
  ) {
    const context = this.context;
    if (
      !context ||
      context.intentKey !== getSwapPerformanceIntentKey(intent) ||
      context.runId !== runId ||
      (eventId && this.retiredEventIds.has(eventId)) ||
      (context.eventId && context.eventId !== eventId)
    ) {
      this.recordStaleDiscard();
      return undefined;
    }
    if (!context.eventId && eventId) context.eventId = eventId;
    return context;
  }

  private recordStaleDiscard() {
    if (!this.context) return;
    this.context.staleDiscardCount += 1;
    this.firstQuoteManager.getCurrent()?.mark('stale_discarded');
    this.settledManager.getCurrent()?.mark('stale_discarded');
  }

  private getScenario(
    intent: ISwapPerformanceIntent,
  ): ISwapPerformanceScenario {
    const previous = this.previousIntent;
    if (!previous) return 'first_open';
    if (
      intent.manualRefresh ||
      getSwapPerformanceIntentKey(previous) ===
        getSwapPerformanceIntentKey(intent)
    ) {
      return 'manual_refresh';
    }
    if (getNetworkKey(previous) !== getNetworkKey(intent)) {
      return 'network_change';
    }
    if (
      getTokenKey(previous) !== getTokenKey(intent) ||
      previous.quoteMode !== intent.quoteMode
    ) {
      return 'token_change';
    }
    return 'amount_change';
  }

  private reportQuoteTerminal(
    eventName: 'swapPerfFirstQuote' | 'swapPerfQuoteSettled',
    info: IPerformanceJourneyTerminalInfo,
    context: ISwapPerformanceContext,
  ) {
    logPerformanceJourneyTerminalLocal(eventName, info);
    if (!info.sampled) return;
    let result: ISwapPerformanceResult = info.state;
    if (info.state === 'success') {
      result =
        eventName === 'swapPerfFirstQuote'
          ? (context.firstResult ?? 'empty')
          : (context.result ?? 'empty');
    }
    this.reporter(eventName, {
      scenario: context.scenario,
      quoteMode: context.intent.quoteMode,
      durationMs: info.durationMs,
      firstQuoteMs: info.stageDurations.first_actionable_quote,
      settledMs: info.stageDurations.quote_settled,
      expectedProviderCount: context.expectedProviderCount,
      receivedProviderCount: context.receivedProviderCount,
      successProviderCount: context.successProviders.size,
      staleDiscardCount: context.staleDiscardCount,
      pageVisible: context.pageVisible,
      result,
      errorCode:
        context.errorCode ?? (info.state === 'timeout' ? 'timeout' : undefined),
      sampleRate: info.sampleRate,
    });
  }
}

export const swapPerformance = new SwapPerformanceMonitor();
