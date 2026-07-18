import { defaultLogger } from '../logger/logger';

import type { IPerformanceJourneyTerminalInfo } from './journey';

export type IPerformanceTerminalEventName =
  | 'homePerfReady'
  | 'homePerfRefreshSettled'
  | 'marketChartPerfReady'
  | 'marketChartPerfSymbolSwitch'
  | 'marketChartPerfError'
  | 'swapPerfPageReady'
  | 'swapPerfFirstQuote'
  | 'swapPerfQuoteSettled';

type IPerformanceTerminalPayload = Record<string, unknown>;

export function reportPerformanceTerminal(
  eventName: IPerformanceTerminalEventName,
  payload: Record<string, unknown>,
): IPerformanceTerminalPayload {
  try {
    const scene = defaultLogger.app.performanceJourney;
    switch (eventName) {
      case 'homePerfReady':
        scene.homePerfReady(payload);
        break;
      case 'homePerfRefreshSettled':
        scene.homePerfRefreshSettled(payload);
        break;
      case 'marketChartPerfReady':
        scene.marketChartPerfReady(payload);
        break;
      case 'marketChartPerfSymbolSwitch':
        scene.marketChartPerfSymbolSwitch(payload);
        break;
      case 'marketChartPerfError':
        scene.marketChartPerfError(payload);
        break;
      case 'swapPerfPageReady':
        scene.swapPerfPageReady(payload);
        break;
      case 'swapPerfFirstQuote':
        scene.swapPerfFirstQuote(payload);
        break;
      case 'swapPerfQuoteSettled':
        scene.swapPerfQuoteSettled(payload);
        break;
      default:
        break;
    }
  } catch {
    // Logger failures are isolated from application behavior.
  }
  return payload;
}

export function logPerformanceJourneyTerminalLocal(
  eventName: IPerformanceTerminalEventName,
  info: IPerformanceJourneyTerminalInfo,
) {
  try {
    defaultLogger.app.performanceJourney.terminalLocal({
      eventName,
      journeyId: info.journeyId,
      generation: info.generation,
      state: info.state,
      durationMs: info.durationMs,
      sampled: info.sampled,
    });
  } catch {
    // Logger failures are isolated from application behavior.
  }
}
