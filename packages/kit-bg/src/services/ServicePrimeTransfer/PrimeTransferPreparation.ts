import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeTransferPreparationProgress } from '@onekeyhq/shared/types/prime/primeTransferNetworkTypes';

// Work-weighted milestones, not elapsed-time estimates. Each range advances
// only after its accounts, credentials, wallets, or whole-payload job completes.
// Collecting existing records is cheap, so it only takes the first 10%.
const collectingRanges = {
  accounts: [0, 5],
  credentials: [5, 7],
  wallets: [7, 10],
} as const;

const COLLECTING_END = collectingRanges.wallets[1];

// Relative cost of the payload stages. Only the stages on the executed path
// share the remaining range, so a skipped branch leaves no percentage gap.
const payloadWeights = {
  decrypting: 70,
  wrappingCredentials: 10,
  legacyCredentials: 70,
  serializing: 5,
  encrypting: 5,
} as const;

export type IPrimeTransferPayloadStage = keyof typeof payloadWeights;

export type IPrimeTransferPreparationStage =
  | keyof typeof collectingRanges
  | IPrimeTransferPayloadStage;

// Peers >= v6.4.0 read the wrapped credential payload only.
export const PRIME_TRANSFER_DEFAULT_PAYLOAD_STAGES: IPrimeTransferPayloadStage[] =
  ['decrypting', 'wrappingCredentials', 'serializing', 'encrypting'];

function buildPayloadRanges(stages: IPrimeTransferPayloadStage[]) {
  const totalWeight = stages.reduce(
    (total, stage) => total + payloadWeights[stage],
    0,
  );
  const ranges: Partial<
    Record<IPrimeTransferPayloadStage, readonly [number, number]>
  > = {};
  let completedWeight = 0;
  for (const stage of stages) {
    const start =
      COLLECTING_END + ((100 - COLLECTING_END) * completedWeight) / totalWeight;
    completedWeight += payloadWeights[stage];
    const end =
      COLLECTING_END + ((100 - COLLECTING_END) * completedWeight) / totalWeight;
    ranges[stage] = [start, end];
  }
  return ranges;
}

export class PrimeTransferPreparation {
  private active = true;

  private percentage = 0;

  private lastPublishedAt = 0;

  private payloadRanges = buildPayloadRanges(
    PRIME_TRANSFER_DEFAULT_PAYLOAD_STAGES,
  );

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

  // Call once the sending path is known and before its first payload stage.
  setPayloadStages(stages: IPrimeTransferPayloadStage[]) {
    this.payloadRanges = buildPayloadRanges([...new Set(stages)]);
  }

  private getRange(stage: IPrimeTransferPreparationStage) {
    if (stage in collectingRanges) {
      return collectingRanges[stage as keyof typeof collectingRanges];
    }
    return this.payloadRanges[stage as IPrimeTransferPayloadStage];
  }

  async update(
    stage: IPrimeTransferPreparationStage,
    completed = 1,
    total = 1,
  ) {
    this.assertActive();
    const range = this.getRange(stage);
    // A stage outside the planned path has no share of the progress.
    if (!range) return;
    const [start, end] = range;
    const fraction =
      total > 0 ? Math.min(1, Math.max(0, completed / total)) : 1;
    const percentage = Math.floor(
      fraction === 1 ? end : start + (end - start) * fraction,
    );
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
