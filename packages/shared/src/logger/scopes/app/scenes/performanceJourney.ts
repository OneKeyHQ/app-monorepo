import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

type IPerformanceTerminalPayload = Record<string, unknown>;

export class PerformanceJourneyScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  homePerfReady(payload: IPerformanceTerminalPayload) {
    return payload;
  }

  @LogToServer()
  @LogToLocal()
  homePerfRefreshSettled(payload: IPerformanceTerminalPayload) {
    return payload;
  }

  @LogToServer()
  @LogToLocal()
  marketChartPerfReady(payload: IPerformanceTerminalPayload) {
    return payload;
  }

  @LogToServer()
  @LogToLocal()
  marketChartPerfSymbolSwitch(payload: IPerformanceTerminalPayload) {
    return payload;
  }

  @LogToServer()
  @LogToLocal()
  marketChartPerfError(payload: IPerformanceTerminalPayload) {
    return payload;
  }

  @LogToServer()
  @LogToLocal()
  swapPerfPageReady(payload: IPerformanceTerminalPayload) {
    return payload;
  }

  @LogToServer()
  @LogToLocal()
  swapPerfFirstQuote(payload: IPerformanceTerminalPayload) {
    return payload;
  }

  @LogToServer()
  @LogToLocal()
  swapPerfQuoteSettled(payload: IPerformanceTerminalPayload) {
    return payload;
  }

  @LogToLocal()
  terminalLocal(payload: {
    eventName: string;
    journeyId: string;
    generation: number;
    state: string;
    durationMs: number;
    sampled: boolean;
  }) {
    return payload;
  }
}
