import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

/**
 * Per-account Monero scan state: the opt-in intent, plus where to resume
 * from if disabled and re-enabled.
 */

export type IXmrAccountScanState = {
  /** What the user asked for. Distinct from whether it has taken effect. */
  intent: 'on' | 'off';
  /**
   * An enable/disable in flight; a crash mid-operation leaves this set, and
   * resumePendingOperations finishes the job on next start.
   */
  operation?: { type: 'enable' | 'disable'; startedAt: number };
  /** Where scanning starts. Asked for at enable time. */
  birthdayHeight?: number;
  birthdaySource?: string;
  birthdayTimestamp?: number;
  /**
   * Recorded at disable time, deliberately a little behind real progress
   * (reorg safety). Losing it just means a full rescan from birthday.
   */
  resumeFromHeight?: number;
  /** Whether key images have been imported, which spend detection needs. */
  keyImagesImportedAt?: number;
};

/**
 * Monero never links a tx to the paid address on chain; this is the only
 * record of who we sent to, kept host-side since a rescan can't recover it.
 */
export type IXmrSentRecipients = Record<string, string>;

export type IXmrSentAmount = {
  amountAtomic: string;
  feeAtomic: string;
  broadcastOutcomeUnknown?: boolean;
};

export interface IXmrDB {
  /** Keyed by accountId. */
  accounts?: Record<string, IXmrAccountScanState>;
  /** accountId -> txid -> recipient address. */
  sentRecipients?: Record<string, IXmrSentRecipients>;
  sentAmounts?: Record<string, Record<string, IXmrSentAmount>>;
  /** Node URL last used, for the settings page to show without probing. */
  lastSyncEndpoint?: { url: string; atMs: number };
  diagnosticsEnabled?: boolean;
}

const xmrStoredDataSchema = z
  .object({
    accounts: z
      .record(z.object({ intent: z.enum(['on', 'off']) }).passthrough())
      .optional(),
    sentRecipients: z.record(z.record(z.string())).optional(),
    sentAmounts: z
      .record(
        z.record(
          z
            .object({
              amountAtomic: z.string().regex(/^\d+$/),
              feeAtomic: z.string().regex(/^\d+$/),
            })
            .passthrough(),
        ),
      )
      .optional(),
    lastSyncEndpoint: z
      .object({ url: z.string(), atMs: z.number().finite() })
      .passthrough()
      .optional(),
    diagnosticsEnabled: z.boolean().optional(),
  })
  .passthrough();

export class SimpleDbEntityXmr extends SimpleDbEntityBase<IXmrDB> {
  entityName = 'xmr';

  override enableCache = false;

  // Sent-recipient context cannot be reconstructed by a chain rescan.
  protected override readonly enableUnreadableRecordSelfHeal = false;

  protected override readonly rejectInvalidStoredData = true;

  protected override validateStoredData(data: unknown): void {
    if (!xmrStoredDataSchema.safeParse(data).success) {
      throw new OneKeyLocalError('simpledb: invalid persisted data (xmr)');
    }
  }

  async getAccountState(params: {
    accountId: string;
  }): Promise<IXmrAccountScanState> {
    const data = await this.getRawData();
    return (
      data?.accounts?.[params.accountId] ?? {
        intent: 'off',
      }
    );
  }

  async setAccountState(params: {
    accountId: string;
    state: IXmrAccountScanState;
  }): Promise<void> {
    await this.setRawData((raw) => ({
      ...raw,
      accounts: {
        ...raw?.accounts,
        [params.accountId]: params.state,
      },
    }));
  }

  /**
   * Journal intent before doing work: a crash here is resumed by
   * resumePendingOperations, else the account would claim 'off' with a
   * database that already exists.
   */
  async beginEnable(params: {
    accountId: string;
    birthdayHeight: number;
    birthdaySource?: string;
    birthdayTimestamp?: number;
  }): Promise<void> {
    const prev = await this.getAccountState({ accountId: params.accountId });
    await this.setAccountState({
      accountId: params.accountId,
      state: {
        ...prev,
        intent: 'on',
        operation: { type: 'enable', startedAt: Date.now() },
        birthdayHeight: params.birthdayHeight,
        birthdaySource: params.birthdaySource,
        birthdayTimestamp: params.birthdayTimestamp,
      },
    });
  }

  async completeEnable(params: {
    accountId: string;
    birthdayHeight?: number;
  }): Promise<void> {
    const prev = await this.getAccountState({ accountId: params.accountId });
    await this.setAccountState({
      accountId: params.accountId,
      state: {
        ...prev,
        intent: 'on',
        operation: undefined,
        birthdayHeight: params.birthdayHeight ?? prev.birthdayHeight,
      },
    });
  }

  async beginDisable(params: {
    accountId: string;
    resumeFromHeight?: number;
  }): Promise<void> {
    const prev = await this.getAccountState(params);
    await this.setAccountState({
      accountId: params.accountId,
      state: {
        ...prev,
        operation: { type: 'disable', startedAt: Date.now() },
        resumeFromHeight: params.resumeFromHeight ?? prev.resumeFromHeight,
      },
    });
  }

  async completeDisable(params: { accountId: string }): Promise<void> {
    const prev = await this.getAccountState(params);
    await this.setAccountState({
      accountId: params.accountId,
      state: { ...prev, intent: 'off', operation: undefined },
    });
  }

  async listPendingOperations(options?: {
    startedBefore?: number;
  }): Promise<{ accountId: string; state: IXmrAccountScanState }[]> {
    const data = await this.getRawData();
    return Object.entries(data?.accounts ?? {})
      .filter(
        ([, state]) =>
          state.operation !== undefined &&
          (options?.startedBefore === undefined ||
            state.operation.startedAt < options.startedBefore),
      )
      .map(([accountId, state]) => ({ accountId, state }));
  }

  // Empty means the runtime database was never created. A birthday kept after
  // deleting local data never touches the runtime, so it does not count.
  async hasAnyAccountState(): Promise<boolean> {
    const data = await this.getRawData();
    return Object.values(data?.accounts ?? {}).some(
      (state) =>
        state.intent === 'on' ||
        state.operation !== undefined ||
        state.resumeFromHeight !== undefined,
    );
  }

  // What GC checks against still-existing accounts.
  async listAccountIds(): Promise<string[]> {
    const data = await this.getRawData();
    return Object.keys(data?.accounts ?? {});
  }

  async listEnabledAccountIds(): Promise<string[]> {
    const data = await this.getRawData();
    return Object.entries(data?.accounts ?? {})
      .filter(([, s]) => s.intent === 'on' && !s.operation)
      .map(([accountId]) => accountId);
  }

  /**
   * Forget an account. Deleting local data keeps its birthday so a later
   * enable starts where its funds do; removing the account keeps nothing.
   */
  async removeAccount(params: {
    accountId: string;
    keepBirthday?: boolean;
  }): Promise<void> {
    await this.setRawData((raw) => {
      const accounts = { ...raw?.accounts };
      const previous = accounts[params.accountId];
      delete accounts[params.accountId];
      if (params.keepBirthday && previous?.birthdayHeight !== undefined) {
        accounts[params.accountId] = {
          intent: 'off',
          birthdayHeight: previous.birthdayHeight,
          birthdaySource: previous.birthdaySource,
          birthdayTimestamp: previous.birthdayTimestamp,
        };
      }
      // Drops recorded recipients too, or they'd outlive the account the user
      // asked to delete.
      const sentRecipients = { ...raw?.sentRecipients };
      delete sentRecipients[params.accountId];
      const sentAmounts = { ...raw?.sentAmounts };
      delete sentAmounts[params.accountId];
      return {
        ...raw,
        accounts,
        sentRecipients,
        sentAmounts,
      };
    });
  }

  /**
   * Called at broadcast: the last moment this exists, since the chain
   * doesn't carry it and a rescan can't recover it.
   */
  async recordSentRecipient(params: {
    accountId: string;
    txid: string;
    recipient: string;
    amountAtomic?: string;
    feeAtomic?: string;
    broadcastOutcomeUnknown?: boolean;
  }): Promise<void> {
    const { accountId, txid, recipient } = params;
    await this.setRawData((raw) => ({
      ...raw,
      sentRecipients: {
        ...raw?.sentRecipients,
        [accountId]: {
          ...raw?.sentRecipients?.[accountId],
          [txid]: recipient,
        },
      },
      sentAmounts: {
        ...raw?.sentAmounts,
        [accountId]: {
          ...raw?.sentAmounts?.[accountId],
          ...(params.amountAtomic !== undefined &&
          params.feeAtomic !== undefined
            ? {
                [txid]: {
                  amountAtomic: params.amountAtomic,
                  feeAtomic: params.feeAtomic,
                  ...(params.broadcastOutcomeUnknown
                    ? { broadcastOutcomeUnknown: true }
                    : {}),
                },
              }
            : {}),
        },
      },
    }));
  }

  async getSentRecipients(params: {
    accountId: string;
  }): Promise<IXmrSentRecipients> {
    const raw = await this.getRawData();
    return raw?.sentRecipients?.[params.accountId] ?? {};
  }

  async getSentAmounts(params: {
    accountId: string;
  }): Promise<Record<string, IXmrSentAmount>> {
    const raw = await this.getRawData();
    return raw?.sentAmounts?.[params.accountId] ?? {};
  }

  async setDiagnosticsEnabled(enabled: boolean): Promise<void> {
    await this.setRawData((raw) => ({ ...raw, diagnosticsEnabled: enabled }));
  }

  async recordSyncEndpoint(url: string): Promise<void> {
    await this.setRawData((raw) => ({
      ...raw,
      lastSyncEndpoint: { url, atMs: Date.now() },
    }));
  }
}
