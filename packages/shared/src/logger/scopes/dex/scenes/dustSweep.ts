import type {
  IDustSweepEntry,
  IDustSweepReason,
} from '@onekeyhq/shared/types/swap/dustSweep';

import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export class DustSweepScene extends BaseScene {
  @LogToServer()
  dustSweepPageVisited(params: {
    page: 'select' | 'progress';
    entry?: IDustSweepEntry;
    tokenCount: number;
    hiddenTokenCount: number;
  }) {
    return params;
  }

  @LogToServer()
  dustSweepAddHidden(params: { hiddenCount: number; hiddenTotalUsd: string }) {
    return params;
  }

  @LogToServer()
  dustSweepStart(params: {
    network: string;
    tokenCount: number;
    totalUsd: string;
    slippage: number;
  }) {
    return params;
  }

  @LogToServer()
  dustSweepItemResult(params: {
    network: string;
    tokenSymbol: string;
    tokenValueUsd: string;
    status: 'success' | 'skipped' | 'failed';
    reason: IDustSweepReason | '';
  }) {
    return params;
  }

  @LogToServer()
  dustSweepResult(params: {
    network: string;
    totalCount: number;
    successCount: number;
    skippedCount: number;
    receivedAmount: string;
    receivedUsd: string;
    durationSec: number;
    endReason: 'completed' | 'stopped' | 'left';
  }) {
    return params;
  }
}
