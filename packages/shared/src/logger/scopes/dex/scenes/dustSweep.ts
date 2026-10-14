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
  dustSweepAddHidden(params: { hiddenCount: number }) {
    return params;
  }

  @LogToServer()
  dustSweepStart(params: {
    network: string;
    tokenCount: number;
    slippage: number;
  }) {
    return params;
  }

  @LogToServer()
  dustSweepItemResult(params: {
    network: string;
    tokenSymbol: string;
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
    failedCount: number;
    receiptAvailable: boolean;
    durationSec: number;
    endReason: 'completed' | 'stopped' | 'left';
  }) {
    return params;
  }
}
