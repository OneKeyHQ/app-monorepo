import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeTransferPreparationProgress } from '@onekeyhq/shared/types/prime/primeTransferNetworkTypes';

// Work-weighted milestones, not elapsed-time estimates. Each range advances
// only after its accounts, credentials, wallets, or whole-payload job completes.
const ranges = {
  accounts: [0, 20],
  credentials: [20, 30],
  wallets: [30, 40],
  decrypting: [40, 75],
  legacyCredentials: [75, 90],
  serializing: [90, 95],
  encrypting: [95, 100],
} as const;

export class PrimeTransferPreparation {
  private active = true;

  private percentage = 0;

  private lastPublishedAt = 0;

  constructor(
    readonly taskId: string,
    private publish: (
      progress: IPrimeTransferPreparationProgress,
    ) => Promise<void>,
  ) {}

  cancel() {
    this.active = false;
  }

  assertActive() {
    if (!this.active) throw new OneKeyLocalError('Transfer cancelled');
  }

  async update(stage: keyof typeof ranges, completed = 1, total = 1) {
    this.assertActive();
    const [start, end] = ranges[stage];
    const fraction =
      total > 0 ? Math.min(1, Math.max(0, completed / total)) : 1;
    const percentage = Math.floor(start + (end - start) * fraction);
    if (percentage < this.percentage) return;
    this.percentage = percentage;
    const now = Date.now();
    if (fraction !== 0 && fraction !== 1 && now - this.lastPublishedAt < 100)
      return;
    this.lastPublishedAt = now;
    await this.publish({ taskId: this.taskId, percentage });
    // Web shares the UI thread with services. Give a paint opportunity during
    // long loops even when the database returns already-resolved promises.
    await timerUtils.wait(0);
    this.assertActive();
  }
}
