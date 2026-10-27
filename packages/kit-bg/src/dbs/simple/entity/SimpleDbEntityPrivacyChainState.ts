import { isEqual, isPlainObject, uniq } from 'lodash';
import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Scan state of every privacy chain account, wallet facts and device settings. Evolve the schema
// additively: an older bundle after a rollback reads an unparseable record as off.

export type IZcashBirthdaySource =
  | 'fresh-wallet'
  | 'restore-month'
  | 'manual-month'
  | 'manual-height'
  | 'automatic-recovery';

export type IZcashPendingRescan = {
  birthdayHeight: number;
  birthdaySource: IZcashBirthdaySource;
  birthdayTimestamp?: number;
  requestedAt: number;
};

export type IZcashPrivacyModeIntent = 'off' | 'on';

export type IZcashPrivacyModeOperation = {
  type: 'enable' | 'disable';
  requestedAt: number;
};

export type IZcashBirthdayMonthHint = {
  timestamp: number;
  source: 'created-wallet' | 'imported-wallet';
};

export type IZcashPrivacyModeState = {
  intent: IZcashPrivacyModeIntent;
  birthdayHeight?: number;
  birthdaySource?: IZcashBirthdaySource;
  birthdayTimestamp?: number;
  birthdayMonthHint?: IZcashBirthdayMonthHint;
  resumeFromHeight?: number;
  // A hidden identity must catch up before sharing the scan queue again.
  scanExcludedFromHeight?: number;
  operation?: IZcashPrivacyModeOperation;
  updatedAt: number;
};

export type IZcashPrivacyModeStateView = Partial<IZcashPrivacyModeState> & {
  intent: IZcashPrivacyModeIntent;
};

// Viewing-level account metadata (xpub-equivalent exposure); the UFVK lives in the viewing key store.
export interface IZcashAccountMeta {
  // Fingerprint of the account's UFVK: the key read back must match it.
  vkFp: string;
  unifiedAddress: string;
  // Hardware only: the app's own derivation when it differs from the
  // device-displayed address (the device UA also carries P2PKH).
  derivedUnifiedAddress?: string;
  transparentAddress: string;
  addressSchemeVersion?: number;
  seedFingerprintHex: string;
  hdIndex: number;
  birthdayHeight?: number;
  birthdaySource?: IZcashBirthdaySource;
  // Diagnostic only; birthdayHeight is the sole scanner authority.
  birthdayTimestamp?: number;
  createdAt: number;
}

export type IXmrAccountScanState = {
  deletionPending?: boolean;
  epoch?: string;
  appliedEpoch?: string;
  forceRescan?: boolean;
  intent: 'on' | 'off';
  /** Set while an enable/disable is in flight; a crash leaves it for resumePendingOperations. */
  operation?: { type: 'enable' | 'disable'; startedAt: number };
  birthdayHeight?: number;
  birthdaySource?: string;
  birthdayTimestamp?: number;
  /** Recorded slightly behind real progress (reorg safety); losing it means a rescan from birthday. */
  resumeFromHeight?: number;
  keyImagesImportedAt?: number;
};

// Each record is validated on read; a malformed one reads as 'not enabled, needs repair'.

const finiteNumber = z.number().finite();

const birthdaySchema = z.object({
  height: finiteNumber,
  source: z.string().min(1).optional(),
  timestamp: finiteNumber.optional(),
});

const accountRecordSchema = z.object({
  networkId: z.string().min(1),
  walletId: z.string(),
  // The reference identity: a key read or derived for this account must match it. Absent until first derived.
  vkFp: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .optional(),
  // Random 64-bit hex renewed when scan data or target changes, so stale work cannot overwrite the current request.
  epoch: z.string().regex(/^[0-9a-f]{16}$/),
  scan: z.object({
    intent: z.enum(['on', 'off']),
    deletion: z
      .object({
        requestId: z.string().regex(/^[0-9a-f]{16}$/),
        reenable: z.boolean().optional(),
      })
      .optional(),
    appliedEpoch: z
      .string()
      .regex(/^[0-9a-f]{16}$/)
      .optional(),
    forceRescan: z.boolean().optional(),
    operation: z
      .object({
        type: z.enum(['enable', 'disable']),
        startedAt: finiteNumber,
      })
      .optional(),
    birthday: birthdaySchema.optional(),
    // Zcash: what the latest enable asked for until setup resolves it into `birthday`.
    birthdayRequest: z
      .object({
        height: finiteNumber.optional(),
        timestamp: finiteNumber.optional(),
      })
      .optional(),
    resumeFromHeight: finiteNumber.optional(),
    // Zcash repair journal; separate from `operation` because an enable can run a rescan while its journal is open.
    rescan: z
      .object({
        birthday: birthdaySchema.extend({ source: z.string().min(1) }),
        requestedAt: finiteNumber,
      })
      .optional(),
    // Sync slot rotation order: the user's latest enable, and latest enable or refresh.
    enabledAt: finiteNumber.optional(),
    refreshedAt: finiteNumber.optional(),
  }),
  chain: z
    .object({
      zcash: z
        .object({
          unifiedAddress: z.string().min(1),
          derivedUnifiedAddress: z.string().min(1).optional(),
          transparentAddress: z.string().min(1),
          addressSchemeVersion: z.number().int().nonnegative().optional(),
          hdIndex: z.number().int().nonnegative(),
          scanExcludedFromHeight: finiteNumber.optional(),
        })
        .optional(),
      xmr: z
        .object({
          keyImagesImportedAt: finiteNumber.optional(),
        })
        .optional(),
    })
    .optional(),
  createdAt: finiteNumber,
  updatedAt: finiteNumber,
});

export type IPrivacyChainAccountRecord = z.infer<typeof accountRecordSchema>;

export type IPrivacyChainPendingAccountDeletion = {
  accountId: string;
  networkId: string;
  requestId: string;
  reenabled?: boolean;
};

const walletRecordSchema = z.object({
  // True only for a freshly generated mnemonic; absent means not proven fresh.
  freshMnemonic: z.boolean().optional(),
  createdAt: finiteNumber.optional(),
  chain: z
    .object({
      // ZIP-32 seed fingerprint: an identifier, not viewing material, so it survives privacy-off and data deletion.
      zcash: z
        .object({ seedFingerprintHex: z.string().regex(/^[0-9a-f]{64}$/) })
        .optional(),
    })
    .optional(),
});

export type IPrivacyChainWalletRecord = z.infer<typeof walletRecordSchema>;

export interface IPrivacyChainStateDB {
  device?: { allowCellularSync?: boolean };
  // Networks whose scan database an app reset failed to delete; retried on the next launch and reset.
  pendingLocalDataDrop?: string[];
  // Networks whose runtime may hold an account nothing names any more; cleared by an orphan purge or database drop.
  runtimeOrphans?: string[];
  wallets?: Record<string, unknown>;
  // Only accounts ever enabled have a record; missing means off.
  accounts?: Record<string, unknown>;
}

type IMutableState = {
  device: IPrivacyChainStateDB['device'];
  pendingLocalDataDrop: unknown;
  runtimeOrphans: unknown;
  wallets: Record<string, unknown>;
  accounts: Record<string, unknown>;
};

// Drops undefined keys, so a record compares and stores the same everywhere.
function compact<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => compact(item)) as T;
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
        item === undefined ? [] : [[key, compact(item)]],
      ),
    ) as T;
  }
  return value;
}

function parseAccountRecord(
  raw: unknown,
): IPrivacyChainAccountRecord | undefined {
  const result = accountRecordSchema.safeParse(raw);
  if (!result.success) return undefined;
  return compact(result.data);
}

function parseWalletRecord(
  raw: unknown,
): IPrivacyChainWalletRecord | undefined {
  const result = walletRecordSchema.safeParse(raw);
  return result.success ? compact(result.data) : undefined;
}

// Builders write only schema fields; a record that would not read back is refused here.
function toStoredAccountRecord(
  record: IPrivacyChainAccountRecord,
): IPrivacyChainAccountRecord {
  const parsed = parseAccountRecord(compact(record));
  if (!parsed) {
    throw new OneKeyLocalError('privacy chain: invalid account state');
  }
  return parsed;
}

function toStoredWalletRecord(
  record: IPrivacyChainWalletRecord,
): IPrivacyChainWalletRecord {
  const parsed = parseWalletRecord(compact(record));
  if (!parsed) {
    throw new OneKeyLocalError('privacy chain: invalid wallet state');
  }
  return parsed;
}

// A malformed record may still name its network; otherwise it counts under every network.
function rawRecordNetworkId(raw: unknown): string | undefined {
  const parsed = parseAccountRecord(raw);
  if (parsed) return parsed.networkId;
  const networkId = isPlainObject(raw)
    ? (raw as Record<string, unknown>).networkId
    : undefined;
  return typeof networkId === 'string' && networkId ? networkId : undefined;
}

function rawRecordWalletId(raw: unknown): string | undefined {
  const walletId = isPlainObject(raw)
    ? (raw as Record<string, unknown>).walletId
    : undefined;
  return typeof walletId === 'string' ? walletId : undefined;
}

function mayBelongToNetwork(raw: unknown, networkId: string): boolean {
  const recordNetworkId = rawRecordNetworkId(raw);
  return recordNetworkId === undefined || recordNetworkId === networkId;
}

function createEpoch(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function holdsScanData(record: IPrivacyChainAccountRecord): boolean {
  return (
    record.scan.intent === 'on' ||
    record.scan.operation !== undefined ||
    record.scan.resumeFromHeight !== undefined ||
    record.scan.rescan !== undefined ||
    record.scan.deletion !== undefined
  );
}

// A requested deletion no re-enable took back: the account's data goes.
function isBeingDeleted(record: IPrivacyChainAccountRecord): boolean {
  return !!record.scan.deletion && !record.scan.deletion.reenable;
}

function isScanning(record: IPrivacyChainAccountRecord): boolean {
  return (
    record.scan.intent === 'on' &&
    record.scan.operation === undefined &&
    record.scan.deletion === undefined
  );
}

function zcashWalletMonthHint(
  wallet: IPrivacyChainWalletRecord | undefined,
): IZcashBirthdayMonthHint | undefined {
  return wallet?.freshMnemonic && typeof wallet.createdAt === 'number'
    ? { timestamp: wallet.createdAt, source: 'created-wallet' }
    : undefined;
}

function buildZcashStateView(
  record: IPrivacyChainAccountRecord,
  wallet: IPrivacyChainWalletRecord | undefined,
  includePendingRescan = false,
): IZcashPrivacyModeStateView {
  const { scan } = record;
  const request = scan.birthdayRequest;
  const pendingBirthday =
    includePendingRescan && !scan.operation ? scan.rescan?.birthday : undefined;
  let birthdayHeight = request ? request.height : scan.birthday?.height;
  let birthdayTimestamp = request
    ? request.timestamp
    : scan.birthday?.timestamp;
  if (pendingBirthday) {
    birthdayHeight = pendingBirthday.height;
    birthdayTimestamp = pendingBirthday.timestamp;
  }
  return compact({
    intent: scan.intent,
    birthdayHeight,
    birthdaySource: (pendingBirthday?.source ?? scan.birthday?.source) as
      | IZcashBirthdaySource
      | undefined,
    birthdayTimestamp,
    birthdayMonthHint:
      zcashWalletMonthHint(wallet) ??
      (birthdayTimestamp !== undefined
        ? { timestamp: birthdayTimestamp, source: 'imported-wallet' as const }
        : undefined),
    resumeFromHeight: scan.resumeFromHeight,
    scanExcludedFromHeight: record.chain?.zcash?.scanExcludedFromHeight,
    operation: scan.operation
      ? { type: scan.operation.type, requestedAt: scan.operation.startedAt }
      : undefined,
    updatedAt: record.updatedAt,
  });
}

function buildZcashMetaView(
  record: IPrivacyChainAccountRecord,
  wallet: IPrivacyChainWalletRecord | undefined,
): IZcashAccountMeta | undefined {
  const zcash = record.chain?.zcash;
  const seedFingerprintHex = wallet?.chain?.zcash?.seedFingerprintHex;
  if (!zcash || !record.vkFp || !seedFingerprintHex) {
    return undefined;
  }
  return compact({
    vkFp: record.vkFp,
    unifiedAddress: zcash.unifiedAddress,
    derivedUnifiedAddress: zcash.derivedUnifiedAddress,
    transparentAddress: zcash.transparentAddress,
    addressSchemeVersion: zcash.addressSchemeVersion,
    seedFingerprintHex,
    hdIndex: zcash.hdIndex,
    birthdayHeight: record.scan.birthday?.height,
    birthdaySource: record.scan.birthday?.source as
      | IZcashBirthdaySource
      | undefined,
    birthdayTimestamp: record.scan.birthday?.timestamp,
    createdAt: record.createdAt,
  });
}

function buildZcashPendingRescan(
  rescan: NonNullable<IPrivacyChainAccountRecord['scan']['rescan']>,
): IZcashPendingRescan {
  return compact({
    birthdayHeight: rescan.birthday.height,
    birthdaySource: rescan.birthday.source as IZcashBirthdaySource,
    birthdayTimestamp: rescan.birthday.timestamp,
    requestedAt: rescan.requestedAt,
  });
}

// Undefined keys don't count: a stored repair has none, the caller's may.
export function isSameZcashPendingRescan(
  left: IZcashPendingRescan | undefined,
  right: IZcashPendingRescan | undefined,
): boolean {
  return isEqual(compact(left), compact(right));
}

// A CAS compares what the caller acted on; `updatedAt` also moves on writes that change none of it.
function zcashStateViewForCas(
  view: IZcashPrivacyModeStateView | undefined,
): Omit<IZcashPrivacyModeStateView, 'updatedAt'> | undefined {
  if (!view) return undefined;
  const { updatedAt: _updatedAt, ...guarded } = compact(view);
  return guarded;
}

function buildXmrView(
  record: IPrivacyChainAccountRecord,
): IXmrAccountScanState {
  const { scan } = record;
  return compact({
    deletionPending: record.scan.deletion ? true : undefined,
    epoch: record.epoch,
    appliedEpoch: scan.appliedEpoch,
    forceRescan: scan.forceRescan,
    intent: scan.intent,
    operation: scan.operation,
    birthdayHeight: scan.birthday?.height,
    birthdaySource: scan.birthday?.source,
    birthdayTimestamp: scan.birthday?.timestamp,
    resumeFromHeight: scan.resumeFromHeight,
    keyImagesImportedAt: record.chain?.xmr?.keyImagesImportedAt,
  });
}

function readAccount(
  state: Pick<IMutableState, 'accounts'>,
  accountId: string,
): IPrivacyChainAccountRecord | undefined {
  return parseAccountRecord(state.accounts[accountId]);
}

function readWallet(
  state: Pick<IMutableState, 'wallets'>,
  walletId: string,
): IPrivacyChainWalletRecord | undefined {
  return parseWalletRecord(state.wallets[walletId]);
}

function writeAccount(
  state: IMutableState,
  accountId: string,
  record: IPrivacyChainAccountRecord,
): void {
  state.accounts[accountId] = toStoredAccountRecord({
    ...record,
    updatedAt: Date.now(),
  });
}

// A malformed record reads as absent and is replaced.
function readOrCreateAccount(
  state: IMutableState,
  { networkId, accountId }: { networkId: string; accountId: string },
): IPrivacyChainAccountRecord {
  const existing = readAccount(state, accountId);
  if (existing && existing.networkId !== networkId) {
    throw new OneKeyLocalError(
      'privacy chain: account state belongs to another network',
    );
  }
  if (existing?.scan.deletion && !existing.scan.deletion.reenable) {
    throw new OneKeyLocalError('privacy chain: account deletion is pending');
  }
  if (existing) return existing;
  const now = Date.now();
  return {
    networkId,
    walletId: accountUtils.getWalletIdFromAccountId({ accountId }),
    epoch: createEpoch(),
    scan: { intent: 'off' },
    createdAt: now,
    updatedAt: now,
  };
}

const ZCASH_STATE_CHANGED_MESSAGE = 'zcash: privacy state changed during setup';

export class SimpleDbEntityPrivacyChainState extends SimpleDbEntityBase<IPrivacyChainStateDB> {
  entityName = 'privacyChainState';

  override enableCache = false;

  // Opt-in intent, birthdays and operation journals are not disposable caches.
  protected override readonly enableUnreadableRecordSelfHeal = false;

  protected override readonly rejectInvalidStoredData = true;

  protected override validateStoredData(data: unknown): void {
    const container = data as IPrivacyChainStateDB;
    if (
      !isPlainObject(data) ||
      (container.device !== undefined && !isPlainObject(container.device)) ||
      (container.pendingLocalDataDrop !== undefined &&
        !Array.isArray(container.pendingLocalDataDrop)) ||
      (container.runtimeOrphans !== undefined &&
        !Array.isArray(container.runtimeOrphans)) ||
      (container.wallets !== undefined && !isPlainObject(container.wallets)) ||
      (container.accounts !== undefined && !isPlainObject(container.accounts))
    ) {
      throw new OneKeyLocalError(
        'simpledb: invalid persisted data (privacyChainState)',
      );
    }
  }

  // Each account's epoch as this runtime last knew it; runs ahead of disk during a destructive operation
  // so cache writes are refused from its start.
  private readonly epochMirror = new Map<string, string | undefined>();

  private epochMirrorVersion = 0;

  private setMirroredEpoch(accountId: string, epoch: string | undefined) {
    this.epochMirror.set(accountId, epoch);
    this.epochMirrorVersion += 1;
  }

  private async update(
    build: (state: IMutableState) => void,
  ): Promise<boolean> {
    const committed = await this.setRawData((raw) => {
      const state: IMutableState = {
        device: raw?.device,
        pendingLocalDataDrop: raw?.pendingLocalDataDrop,
        runtimeOrphans: raw?.runtimeOrphans,
        wallets: { ...raw?.wallets },
        accounts: { ...raw?.accounts },
      };
      build(state);
      for (const accountId of uniq([
        ...Object.keys(raw?.accounts ?? {}),
        ...Object.keys(state.accounts),
      ])) {
        if (state.accounts[accountId] !== raw?.accounts?.[accountId]) {
          this.setMirroredEpoch(
            accountId,
            parseAccountRecord(state.accounts[accountId])?.epoch,
          );
        }
      }
      return compact({
        device: state.device,
        pendingLocalDataDrop: state.pendingLocalDataDrop as
          | string[]
          | undefined,
        runtimeOrphans: state.runtimeOrphans as string[] | undefined,
        wallets: state.wallets,
        accounts: state.accounts,
      });
    });
    return committed !== undefined;
  }

  private async readAccountRecord(accountId: string): Promise<
    | {
        record: IPrivacyChainAccountRecord;
        wallet: IPrivacyChainWalletRecord | undefined;
      }
    | undefined
  > {
    const raw = await this.getRawData();
    const record = parseAccountRecord(raw?.accounts?.[accountId]);
    if (!record) return undefined;
    return {
      record,
      wallet: parseWalletRecord(raw?.wallets?.[record.walletId]),
    };
  }

  private async listNetworkRecords(networkId: string): Promise<
    {
      accountId: string;
      record: IPrivacyChainAccountRecord;
      wallet: IPrivacyChainWalletRecord | undefined;
    }[]
  > {
    const raw = await this.getRawData();
    return Object.entries(raw?.accounts ?? {}).flatMap(([accountId, value]) => {
      const record = parseAccountRecord(value);
      if (!record || record.networkId !== networkId) return [];
      return [
        {
          accountId,
          record,
          wallet: parseWalletRecord(raw?.wallets?.[record.walletId]),
        },
      ];
    });
  }

  async getAllowCellularSync(): Promise<boolean> {
    const raw = await this.getRawData();
    return raw?.device?.allowCellularSync === true;
  }

  async setAllowCellularSync({ allow }: { allow: boolean }): Promise<void> {
    await this.update((state) => {
      state.device = { allowCellularSync: allow };
    });
  }

  // A list that does not read as network ids throws: a reset then treats
  // every network as holding data, never none.
  async getPendingLocalDataDrop(): Promise<string[]> {
    const raw = await this.getRawData();
    const pending: unknown[] = raw?.pendingLocalDataDrop ?? [];
    if (!pending.every((item) => typeof item === 'string')) {
      throw new OneKeyLocalError(
        'privacy chain: unreadable pending local data drop',
      );
    }
    return pending as string[];
  }

  async setPendingLocalDataDrop({
    networkIds,
  }: {
    networkIds: string[];
  }): Promise<void> {
    await this.update((state) => {
      state.pendingLocalDataDrop = networkIds;
    });
  }

  // Removes only the given networks: a reset may have marked others since they were read.
  async removePendingLocalDataDrop({
    networkIds,
  }: {
    networkIds: string[];
  }): Promise<void> {
    await this.update((state) => {
      const pending = state.pendingLocalDataDrop;
      if (!Array.isArray(pending)) return;
      state.pendingLocalDataDrop = pending.filter(
        (networkId) => !networkIds.includes(networkId as string),
      );
    });
  }

  async markRuntimeOrphans({ networkId }: { networkId: string }) {
    await this.update((state) => {
      const marked = Array.isArray(state.runtimeOrphans)
        ? (state.runtimeOrphans as unknown[])
        : [];
      if (!marked.includes(networkId)) {
        state.runtimeOrphans = [...marked, networkId];
      }
    });
  }

  async clearRuntimeOrphans({ networkId }: { networkId: string }) {
    await this.update((state) => {
      if (!Array.isArray(state.runtimeOrphans)) return;
      state.runtimeOrphans = (state.runtimeOrphans as unknown[]).filter(
        (item) => item !== networkId,
      );
    });
  }

  async hasRuntimeOrphans({
    networkId,
  }: {
    networkId: string;
  }): Promise<boolean> {
    const raw = await this.getRawData();
    return (raw?.runtimeOrphans ?? []).includes(networkId);
  }

  async getWalletFreshMnemonic({
    walletId,
  }: {
    walletId: string;
  }): Promise<boolean | undefined> {
    const raw = await this.getRawData();
    return parseWalletRecord(raw?.wallets?.[walletId])?.freshMnemonic;
  }

  async getWalletCreatedAtTimestamp({
    walletId,
  }: {
    walletId: string;
  }): Promise<number | undefined> {
    const raw = await this.getRawData();
    return parseWalletRecord(raw?.wallets?.[walletId])?.createdAt;
  }

  async saveWalletCreationProvenance({
    walletId,
    isFreshlyGeneratedMnemonic,
    createdAt,
  }: {
    walletId: string;
    isFreshlyGeneratedMnemonic: boolean;
    createdAt: number;
  }): Promise<void> {
    await this.update((state) => {
      const wallet = readWallet(state, walletId) ?? {};
      state.wallets[walletId] = toStoredWalletRecord({
        ...wallet,
        freshMnemonic: isFreshlyGeneratedMnemonic,
        createdAt: isFreshlyGeneratedMnemonic
          ? (wallet.createdAt ?? createdAt)
          : wallet.createdAt,
      });
    });
  }

  async getZcashWalletSeedFingerprint({
    walletId,
  }: {
    walletId: string;
  }): Promise<string | undefined> {
    const raw = await this.getRawData();
    return parseWalletRecord(raw?.wallets?.[walletId])?.chain?.zcash
      ?.seedFingerprintHex;
  }

  async saveZcashWalletSeedFingerprint({
    walletId,
    seedFingerprintHex,
  }: {
    walletId: string;
    seedFingerprintHex: string;
  }): Promise<void> {
    await this.update((state) => {
      const wallet = readWallet(state, walletId) ?? {};
      state.wallets[walletId] = toStoredWalletRecord({
        ...wallet,
        chain: {
          ...wallet.chain,
          zcash: { seedFingerprintHex: seedFingerprintHex.toLowerCase() },
        },
      });
    });
  }

  async listWalletStateIds(): Promise<string[]> {
    const raw = await this.getRawData();
    return Object.keys(raw?.wallets ?? {});
  }

  // Kept while an account record still names the wallet: removing that
  // account's runtime data needs the wallet's seed fingerprint.
  async removeWalletState({ walletId }: { walletId: string }): Promise<void> {
    await this.update((state) => {
      const referenced = Object.values(state.accounts).some(
        (record) => rawRecordWalletId(record) === walletId,
      );
      if (!referenced) {
        delete state.wallets[walletId];
      }
    });
  }

  async listAccountIds({
    networkId,
  }: {
    networkId: string;
  }): Promise<string[]> {
    const raw = await this.getRawData();
    return Object.entries(raw?.accounts ?? {}).flatMap(([accountId, value]) =>
      mayBelongToNetwork(value, networkId) ? [accountId] : [],
    );
  }

  // Accounts whose scan data the runtime keeps; undefined when nothing was read (no state, or masked by
  // Travel Mode). [] is not proof the runtime holds nothing. `excludeDeleting` leaves out accounts being
  // deleted: their data stays only until their own deletion, so it keeps no alias's data alive.
  async listScanDataAccountIds({
    networkId,
    excludeDeleting = false,
  }: {
    networkId: string;
    excludeDeleting?: boolean;
  }): Promise<string[] | undefined> {
    const raw = await this.getRawData();
    if (!raw) return undefined;
    return uniq(
      Object.entries(raw.accounts ?? {}).flatMap(([accountId, value]) => {
        if (!mayBelongToNetwork(value, networkId)) return [];
        const record = parseAccountRecord(value);
        if (!record) return [accountId];
        const skipped = excludeDeleting && isBeingDeleted(record);
        return !skipped && holdsScanData(record) ? [accountId] : [];
      }),
    );
  }

  // Other accounts of this one's scan identity being deleted too: one
  // runtime cleanup covers them all.
  async listIdentityDeletions({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<IPrivacyChainPendingAccountDeletion[]> {
    const records = await this.listNetworkRecords(networkId);
    const vkFp = records.find((item) => item.accountId === accountId)?.record
      .vkFp;
    if (vkFp === undefined) return [];
    return records.flatMap(({ accountId: otherId, record }) => {
      const isTwin = otherId !== accountId && record.vkFp === vkFp;
      const deleting = isTwin && isBeingDeleted(record);
      const requestId = record.scan.deletion?.requestId;
      return deleting && requestId !== undefined
        ? [{ accountId: otherId, networkId, requestId }]
        : [];
    });
  }

  async removeAccount({ accountId }: { accountId: string }): Promise<void> {
    await this.update((state) => {
      delete state.accounts[accountId];
    });
  }

  async requestAccountDeletion({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<IPrivacyChainPendingAccountDeletion> {
    let requestId = '';
    const committed = await this.update((state) => {
      const existing = readAccount(state, accountId);
      if (
        existing?.networkId === networkId &&
        existing.scan.deletion &&
        !existing.scan.deletion.reenable
      ) {
        requestId = existing.scan.deletion.requestId;
        return;
      }
      const record = readOrCreateAccount(state, { networkId, accountId });
      requestId = createEpoch();
      writeAccount(state, accountId, {
        ...record,
        epoch: createEpoch(),
        scan: {
          ...record.scan,
          intent: 'off',
          operation: undefined,
          resumeFromHeight: undefined,
          rescan: undefined,
          deletion: { requestId },
        },
      });
    });
    if (!committed) {
      throw new OneKeyLocalError(
        'privacy chain: deletion request could not be persisted',
      );
    }
    return { networkId, accountId, requestId };
  }

  async listPendingAccountDeletions(): Promise<
    IPrivacyChainPendingAccountDeletion[]
  > {
    const raw = await this.getRawData();
    return Object.entries(raw?.accounts ?? {}).flatMap(([accountId, value]) => {
      const record = parseAccountRecord(value);
      return record?.scan.deletion
        ? [
            {
              accountId,
              networkId: record.networkId,
              requestId: record.scan.deletion.requestId,
              ...(record.scan.deletion.reenable &&
              record.scan.intent === 'on' &&
              !record.scan.operation
                ? { reenabled: true }
                : {}),
            },
          ]
        : [];
    });
  }

  async beginAccountReenable({
    accountId,
    requestId,
  }: {
    accountId: string;
    requestId: string;
  }): Promise<void> {
    const committed = await this.update((state) => {
      const record = readAccount(state, accountId);
      if (record?.scan.deletion?.requestId !== requestId) {
        throw new OneKeyLocalError('privacy chain: deletion request changed');
      }
      writeAccount(state, accountId, {
        ...record,
        epoch: createEpoch(),
        scan: {
          ...record.scan,
          deletion: { requestId, reenable: true },
        },
      });
    });
    if (!committed) {
      throw new OneKeyLocalError(
        'privacy chain: enable request could not be persisted',
      );
    }
  }

  async isAccountDeletionPending({
    accountId,
    requestId,
  }: {
    accountId: string;
    requestId?: string;
  }): Promise<boolean> {
    const record = (await this.readAccountRecord(accountId))?.record;
    return requestId === undefined
      ? !!record?.scan.deletion
      : record?.scan.deletion?.requestId === requestId;
  }

  async completeAccountDeletion({
    accountId,
    requestId,
  }: {
    accountId: string;
    requestId: string;
  }): Promise<void> {
    const committed = await this.update((state) => {
      const record = readAccount(state, accountId);
      if (record?.scan.deletion?.requestId !== requestId) return;
      writeAccount(state, accountId, {
        ...record,
        scan: { ...record.scan, deletion: undefined },
      });
    });
    if (!committed) {
      throw new OneKeyLocalError(
        'privacy chain: deletion completion could not be persisted',
      );
    }
  }

  async removeNetworkAccounts({
    networkId,
  }: {
    networkId: string;
  }): Promise<void> {
    await this.update((state) => {
      for (const [accountId, value] of Object.entries(state.accounts)) {
        if (rawRecordNetworkId(value) === networkId) {
          delete state.accounts[accountId];
        }
      }
    });
  }

  async getAccountEpoch({
    accountId,
  }: {
    accountId: string;
  }): Promise<string | undefined> {
    if (this.epochMirror.has(accountId)) {
      return this.epochMirror.get(accountId);
    }
    const version = this.epochMirrorVersion;
    const raw = await this.getRawData();
    const epoch = parseAccountRecord(raw?.accounts?.[accountId])?.epoch;
    // A masked store reads as empty, not as "no record".
    if (raw && version === this.epochMirrorVersion) {
      this.setMirroredEpoch(accountId, epoch);
    }
    return this.epochMirror.has(accountId)
      ? this.epochMirror.get(accountId)
      : epoch;
  }

  async isAccountSyncCurrent({
    accountId,
    epoch,
    allowPaused = false,
  }: {
    accountId: string;
    epoch: string;
    allowPaused?: boolean;
  }): Promise<boolean> {
    const raw = await this.getRawData();
    const record = parseAccountRecord(raw?.accounts?.[accountId]);
    return (
      !!record &&
      record.epoch === epoch &&
      (!this.epochMirror.has(accountId) ||
        this.epochMirror.get(accountId) === epoch) &&
      (isScanning(record) ||
        (allowPaused &&
          record.scan.intent === 'off' &&
          record.scan.resumeFromHeight !== undefined &&
          record.scan.operation === undefined &&
          record.scan.deletion === undefined)) &&
      record.scan.rescan === undefined
    );
  }

  async forgetAccountEpochs(): Promise<void> {
    this.epochMirror.clear();
    this.epochMirrorVersion += 1;
  }

  // The mirror moves first, so a cache write racing the destruction is refused.
  async rotateAccountEpochs({
    accountIds,
  }: {
    accountIds: string[];
  }): Promise<void> {
    if (accountIds.length === 0) return;
    const batchEpoch = createEpoch();
    const rotated = new Map(uniq(accountIds).map((id) => [id, batchEpoch]));
    rotated.forEach((epoch, accountId) =>
      this.setMirroredEpoch(accountId, epoch),
    );
    await this.update((state) => {
      for (const [accountId, epoch] of rotated) {
        const record = readAccount(state, accountId);
        if (record) {
          writeAccount(state, accountId, { ...record, epoch });
        } else {
          this.setMirroredEpoch(accountId, undefined);
        }
      }
    });
  }

  // Delete-local-data: everything pointing into the deleted scan data goes, identity included;
  // only the birthday stays.
  async clearAccountScanData({
    accountId,
  }: {
    accountId: string;
  }): Promise<void> {
    const committed = await this.update((state) => {
      const record = readAccount(state, accountId);
      delete state.accounts[accountId];
      if (
        !record ||
        (!record.scan.birthday &&
          !record.scan.birthdayRequest &&
          !record.scan.deletion)
      )
        return;
      writeAccount(state, accountId, {
        networkId: record.networkId,
        walletId: record.walletId,
        epoch: createEpoch(),
        scan: {
          intent: 'off',
          birthday: record.scan.birthday,
          birthdayRequest: record.scan.birthdayRequest,
          deletion: record.scan.deletion,
        },
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    });
    if (!committed) {
      throw new OneKeyLocalError(
        'privacy chain: local data cleanup could not be persisted',
      );
    }
  }

  // Accounts whose local data stays on disk: syncing, paused, mid-enable, or
  // re-enabled during a deletion. Aliases share one identity.
  async listNetworkDataHolders({
    networkId,
  }: {
    networkId: string;
  }): Promise<{ accountId: string; identity: string }[]> {
    return (await this.listNetworkRecords(networkId)).flatMap(
      ({ accountId, record }) => {
        const { scan } = record;
        if (scan.deletion && !scan.deletion.reenable) return [];
        const holds =
          scan.intent === 'on' ||
          scan.operation?.type === 'enable' ||
          scan.resumeFromHeight !== undefined ||
          !!scan.deletion?.reenable;
        return holds ? [{ accountId, identity: record.vkFp ?? accountId }] : [];
      },
    );
  }

  async getAccountVkFp({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<string | undefined> {
    const record = (await this.readAccountRecord(accountId))?.record;
    return record?.networkId === networkId ? record.vkFp : undefined;
  }

  async touchAccountSyncSlot({
    networkId,
    accountId,
    enabled = false,
  }: {
    networkId: string;
    accountId: string;
    enabled?: boolean;
  }): Promise<void> {
    const now = Date.now();
    await this.update((state) => {
      const record = readAccount(state, accountId);
      if (record?.networkId !== networkId) return;
      writeAccount(state, accountId, {
        ...record,
        scan: {
          ...record.scan,
          refreshedAt: now,
          ...(enabled ? { enabledAt: now } : {}),
        },
      });
    });
  }

  async getAccountSyncSlotTimes({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<{ enabledAt?: number; refreshedAt?: number }> {
    const record = (await this.readAccountRecord(accountId))?.record;
    if (record?.networkId !== networkId) return {};
    return {
      enabledAt: record.scan.enabledAt,
      refreshedAt: record.scan.refreshedAt,
    };
  }

  async getZcashPrivacyModeState({
    accountId,
    includePendingRescan = false,
  }: {
    accountId: string;
    includePendingRescan?: boolean;
  }): Promise<IZcashPrivacyModeStateView> {
    const raw = await this.getRawData();
    const record = parseAccountRecord(raw?.accounts?.[accountId]);
    if (record) {
      return buildZcashStateView(
        record,
        parseWalletRecord(raw?.wallets?.[record.walletId]),
        includePendingRescan,
      );
    }
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    return compact({
      intent: 'off' as const,
      birthdayMonthHint: zcashWalletMonthHint(
        parseWalletRecord(raw?.wallets?.[walletId]),
      ),
    });
  }

  async isZcashPrivacyModeEnabled({
    accountId,
  }: {
    accountId: string;
  }): Promise<boolean> {
    const found = await this.readAccountRecord(accountId);
    return !!found && isScanning(found.record);
  }

  async listZcashEnabledAccountIds({
    networkId,
  }: {
    networkId: string;
  }): Promise<string[]> {
    return (await this.listNetworkRecords(networkId)).flatMap(
      ({ accountId, record }) => (isScanning(record) ? [accountId] : []),
    );
  }

  async beginZcashPrivacyModeEnable({
    networkId,
    accountId,
    birthdayHeight,
    birthdayTimestamp,
    resetResumeFromHeight = false,
  }: {
    networkId: string;
    accountId: string;
    birthdayHeight?: number;
    birthdayTimestamp?: number;
    resetResumeFromHeight?: boolean;
  }): Promise<void> {
    if (birthdayHeight === undefined && birthdayTimestamp === undefined) {
      throw new OneKeyLocalError('zcash: privacy birthday is required');
    }
    if (
      birthdayHeight !== undefined &&
      (!Number.isSafeInteger(birthdayHeight) || birthdayHeight <= 0)
    ) {
      throw new OneKeyLocalError('zcash: privacy birthday height is invalid');
    }
    if (
      birthdayTimestamp !== undefined &&
      (!Number.isFinite(birthdayTimestamp) || birthdayTimestamp <= 0)
    ) {
      throw new OneKeyLocalError(
        'zcash: privacy birthday timestamp is invalid',
      );
    }
    const committed = await this.update((state) => {
      const record = readOrCreateAccount(state, { networkId, accountId });
      const zcash = record.chain?.zcash;
      writeAccount(state, accountId, {
        ...record,
        scan: {
          ...record.scan,
          intent: 'off',
          birthdayRequest: {
            height: birthdayHeight,
            timestamp: birthdayTimestamp,
          },
          resumeFromHeight: resetResumeFromHeight
            ? undefined
            : record.scan.resumeFromHeight,
          operation: { type: 'enable', startedAt: Date.now() },
        },
        chain:
          resetResumeFromHeight && zcash
            ? {
                ...record.chain,
                zcash: { ...zcash, scanExcludedFromHeight: undefined },
              }
            : record.chain,
      });
    });
    if (!committed)
      throw new OneKeyLocalError(
        'zcash: enable request could not be persisted',
      );
  }

  async completeZcashPrivacyModeEnable({
    accountId,
  }: {
    accountId: string;
  }): Promise<void> {
    const committed = await this.update((state) => {
      const current = readAccount(state, accountId);
      if (!current || current.scan.operation?.type !== 'enable') {
        throw new OneKeyLocalError(
          'zcash: privacy enable operation is not pending',
        );
      }
      writeAccount(state, accountId, {
        ...current,
        scan: {
          ...current.scan,
          intent: 'on',
          operation: undefined,
          resumeFromHeight: undefined,
        },
      });
    });
    if (!committed) {
      throw new OneKeyLocalError(
        'zcash: privacy authorization could not be persisted',
      );
    }
  }

  async cancelZcashPendingEnables({
    networkId,
    accountId: targetAccountId,
    requestedBefore,
  }: {
    networkId: string;
    accountId?: string;
    requestedBefore?: number;
  }): Promise<string[]> {
    const cancelledAccountIds: string[] = [];
    await this.update((state) => {
      cancelledAccountIds.length = 0;
      for (const accountId of Object.keys(state.accounts)) {
        const record = readAccount(state, accountId);
        if (
          record?.networkId === networkId &&
          record.scan.operation?.type === 'enable' &&
          (targetAccountId === undefined || targetAccountId === accountId) &&
          (requestedBefore === undefined ||
            record.scan.operation.startedAt < requestedBefore)
        ) {
          writeAccount(state, accountId, {
            ...record,
            scan: { ...record.scan, intent: 'off', operation: undefined },
          });
          cancelledAccountIds.push(accountId);
        }
      }
    });
    return cancelledAccountIds;
  }

  async beginZcashPrivacyModeDisable({
    accountId,
    resumeFromHeight,
  }: {
    accountId: string;
    resumeFromHeight: number;
  }): Promise<void> {
    await this.update((state) => {
      const record = readAccount(state, accountId);
      if (!record) return;
      writeAccount(state, accountId, {
        ...record,
        scan: {
          ...record.scan,
          intent: 'off',
          resumeFromHeight,
          operation: { type: 'disable', startedAt: Date.now() },
        },
      });
    });
  }

  async completeZcashPrivacyModeDisable({
    accountId,
  }: {
    accountId: string;
  }): Promise<void> {
    await this.update((state) => {
      const record = readAccount(state, accountId);
      if (!record) return;
      writeAccount(state, accountId, {
        ...record,
        scan: { ...record.scan, intent: 'off', operation: undefined },
      });
    });
  }

  async listZcashPendingDisables({
    networkId,
    requestedBefore,
  }: {
    networkId: string;
    requestedBefore?: number;
  }): Promise<string[]> {
    return (await this.listNetworkRecords(networkId)).flatMap(
      ({ accountId, record }) =>
        record.scan.operation?.type === 'disable' &&
        (requestedBefore === undefined ||
          record.scan.operation.startedAt < requestedBefore)
          ? [accountId]
          : [],
    );
  }

  async markZcashScanExcluded({
    accountId,
    fromHeight,
  }: {
    accountId: string;
    fromHeight: number;
  }): Promise<void> {
    const committed = await this.update((state) => {
      const record = readAccount(state, accountId);
      const zcash = record?.chain?.zcash;
      if (
        !record ||
        !zcash ||
        (!isScanning(record) && record.scan.operation?.type !== 'enable')
      ) {
        return;
      }
      writeAccount(state, accountId, {
        ...record,
        chain: {
          ...record.chain,
          zcash: {
            ...zcash,
            scanExcludedFromHeight: Math.min(
              zcash.scanExcludedFromHeight ?? fromHeight,
              fromHeight,
            ),
          },
        },
      });
    });
    if (!committed) {
      throw new OneKeyLocalError(
        'zcash: resume request could not be persisted',
      );
    }
  }

  async clearZcashScanExcluded({
    accountId,
    expectedFromHeight,
  }: {
    accountId: string;
    expectedFromHeight: number;
  }): Promise<void> {
    await this.update((state) => {
      const record = readAccount(state, accountId);
      const zcash = record?.chain?.zcash;
      if (
        !record ||
        !zcash ||
        zcash.scanExcludedFromHeight !== expectedFromHeight
      ) {
        return;
      }
      writeAccount(state, accountId, {
        ...record,
        chain: {
          ...record.chain,
          zcash: { ...zcash, scanExcludedFromHeight: undefined },
        },
      });
    });
  }

  async getZcashAccountMeta({
    accountId,
  }: {
    accountId: string;
  }): Promise<IZcashAccountMeta | undefined> {
    const found = await this.readAccountRecord(accountId);
    return found ? buildZcashMetaView(found.record, found.wallet) : undefined;
  }

  async listZcashAccountMetas({
    networkId,
  }: {
    networkId: string;
  }): Promise<{ accountId: string; meta: IZcashAccountMeta }[]> {
    return (await this.listNetworkRecords(networkId)).flatMap(
      ({ accountId, record, wallet }) => {
        const meta = buildZcashMetaView(record, wallet);
        return meta ? [{ accountId, meta }] : [];
      },
    );
  }

  async listZcashMetaAccountIds({
    networkId,
  }: {
    networkId: string;
  }): Promise<string[]> {
    const raw = await this.getRawData();
    return Object.entries(raw?.accounts ?? {}).flatMap(([accountId, value]) => {
      if (!mayBelongToNetwork(value, networkId)) return [];
      const record = parseAccountRecord(value);
      return !record || record.chain?.zcash ? [accountId] : [];
    });
  }

  // Writes viewing metadata and the resolved birthday; the expectations are compare-and-set guards.
  async saveZcashAccountMeta({
    accountId,
    meta,
    expectedPrivacyModeState,
    expectedMeta,
  }: {
    accountId: string;
    meta: IZcashAccountMeta;
    expectedPrivacyModeState?: IZcashPrivacyModeStateView;
    expectedMeta?: IZcashAccountMeta;
  }): Promise<void> {
    const committed = await this.update((state) => {
      const record = readAccount(state, accountId);
      const wallet = record ? readWallet(state, record.walletId) : undefined;
      if (
        (expectedPrivacyModeState !== undefined &&
          !isEqual(
            zcashStateViewForCas(
              record ? buildZcashStateView(record, wallet) : undefined,
            ),
            zcashStateViewForCas(expectedPrivacyModeState),
          )) ||
        (expectedMeta !== undefined &&
          !isEqual(
            record ? buildZcashMetaView(record, wallet) : undefined,
            compact(expectedMeta),
          ))
      ) {
        throw new OneKeyLocalError(ZCASH_STATE_CHANGED_MESSAGE);
      }
      if (!record) {
        throw new OneKeyLocalError(ZCASH_STATE_CHANGED_MESSAGE);
      }
      // The identity never switches under an account.
      if (record.vkFp !== undefined && record.vkFp !== meta.vkFp) {
        throw new OneKeyLocalError(
          'zcash: viewing identity does not match this account',
        );
      }
      const seedFingerprintHex = meta.seedFingerprintHex.toLowerCase();
      const storedSeedFingerprint = wallet?.chain?.zcash?.seedFingerprintHex;
      if (
        storedSeedFingerprint !== undefined &&
        storedSeedFingerprint !== seedFingerprintHex
      ) {
        throw new OneKeyLocalError(
          'zcash: seed fingerprint does not match this wallet',
        );
      }
      state.wallets[record.walletId] = toStoredWalletRecord({
        ...wallet,
        chain: { ...wallet?.chain, zcash: { seedFingerprintHex } },
      });
      writeAccount(state, accountId, {
        ...record,
        vkFp: meta.vkFp,
        scan: {
          ...record.scan,
          birthday:
            meta.birthdayHeight === undefined
              ? undefined
              : {
                  height: meta.birthdayHeight,
                  source: meta.birthdaySource,
                  timestamp: meta.birthdayTimestamp,
                },
          birthdayRequest: undefined,
        },
        chain: {
          ...record.chain,
          zcash: {
            unifiedAddress: meta.unifiedAddress,
            derivedUnifiedAddress: meta.derivedUnifiedAddress,
            transparentAddress: meta.transparentAddress,
            addressSchemeVersion: meta.addressSchemeVersion,
            hdIndex: meta.hdIndex,
            scanExcludedFromHeight: record.chain?.zcash?.scanExcludedFromHeight,
          },
        },
      });
    });
    if (!committed)
      throw new OneKeyLocalError(
        'zcash: viewing metadata could not be persisted',
      );
  }

  async listZcashPendingRescans({
    networkId,
  }: {
    networkId: string;
  }): Promise<{ accountId: string; repair: IZcashPendingRescan }[]> {
    return (await this.listNetworkRecords(networkId)).flatMap(
      ({ accountId, record }) =>
        record.scan.rescan
          ? [{ accountId, repair: buildZcashPendingRescan(record.scan.rescan) }]
          : [],
    );
  }

  // A user request replaces older journals; an automatic repair must not replace it on any alias.
  async saveZcashPendingRescan({
    accountId,
    repair,
    automaticOwner,
  }: {
    accountId: string;
    repair: IZcashPendingRescan;
    automaticOwner?: { epoch: string | undefined; meta: IZcashAccountMeta };
  }): Promise<boolean> {
    let accepted = false;
    const committed = await this.update((state) => {
      const record = readAccount(state, accountId);
      if (automaticOwner) {
        if (
          !record ||
          record.scan.deletion ||
          record.scan.operation ||
          record.epoch !== automaticOwner.epoch ||
          !isEqual(
            buildZcashMetaView(record, readWallet(state, record.walletId)),
            automaticOwner.meta,
          ) ||
          Object.values(state.accounts).some((value) => {
            const alias = parseAccountRecord(value);
            return (
              alias?.networkId === record.networkId &&
              alias.vkFp === record.vkFp &&
              !!alias.scan.rescan
            );
          })
        )
          return;
      }
      if (!record || (record.scan.deletion && !record.scan.deletion.reenable)) {
        throw new OneKeyLocalError(
          'zcash: account is unavailable for rescanning',
        );
      }
      writeAccount(state, accountId, {
        ...record,
        scan: {
          ...record.scan,
          rescan: {
            birthday: {
              height: repair.birthdayHeight,
              source: repair.birthdaySource,
              timestamp: repair.birthdayTimestamp,
            },
            requestedAt: repair.requestedAt,
          },
        },
      });
      accepted = true;
    });
    if (!committed) {
      throw new OneKeyLocalError(
        'zcash: rescan request could not be persisted',
      );
    }
    return accepted;
  }

  async removeZcashPendingRescan({
    accountId,
    expectedRepair,
  }: {
    accountId: string;
    expectedRepair?: IZcashPendingRescan;
  }): Promise<void> {
    await this.update((state) => {
      const record = readAccount(state, accountId);
      if (!record?.scan.rescan) return;
      if (
        expectedRepair !== undefined &&
        !isSameZcashPendingRescan(
          buildZcashPendingRescan(record.scan.rescan),
          expectedRepair,
        )
      ) {
        return;
      }
      writeAccount(state, accountId, {
        ...record,
        scan: { ...record.scan, rescan: undefined },
      });
    });
  }

  async getXmrAccountState({
    accountId,
  }: {
    accountId: string;
  }): Promise<IXmrAccountScanState> {
    const found = await this.readAccountRecord(accountId);
    return found ? buildXmrView(found.record) : { intent: 'off' };
  }

  async saveXmrEnabledAccount({
    networkId,
    accountId,
    vkFp,
    birthdayHeight,
    birthdaySource,
    birthdayTimestamp,
    forceRescan,
    expectedState,
  }: {
    networkId: string;
    accountId: string;
    vkFp: string;
    birthdayHeight: number;
    birthdaySource?: string;
    birthdayTimestamp?: number;
    forceRescan?: boolean;
    expectedState?: IXmrAccountScanState;
  }): Promise<boolean> {
    let applied = false;
    const committed = await this.update((state) => {
      if (expectedState) {
        const current = readAccount(state, accountId);
        if (
          current?.epoch !== expectedState.epoch ||
          (current?.scan.intent ?? 'off') !== expectedState.intent ||
          !isEqual(current?.scan.operation, expectedState.operation)
        )
          return;
      }
      const record = readOrCreateAccount(state, { networkId, accountId });
      if (record.vkFp !== undefined && record.vkFp !== vkFp) {
        throw new OneKeyLocalError(
          'xmr: viewing identity does not match this account',
        );
      }
      const epoch = createEpoch();
      let birthday: NonNullable<
        IPrivacyChainAccountRecord['scan']['birthday']
      > = {
        height: birthdayHeight,
        source: birthdaySource,
        timestamp: birthdayTimestamp,
      };
      // Aliases share one runtime identity, and a later birthday drops what it
      // already found. Enabling one keeps the earliest; only a rescan moves it.
      if (!forceRescan) {
        Object.keys(state.accounts).forEach((otherId) => {
          if (otherId === accountId) return;
          const other = readAccount(state, otherId);
          if (
            other?.networkId === networkId &&
            other.vkFp === vkFp &&
            other.scan.intent === 'on' &&
            other.scan.birthday &&
            other.scan.birthday.height < birthday.height
          ) {
            birthday = other.scan.birthday;
          }
        });
      }
      const rescanRequired = forceRescan ?? record.scan.forceRescan;
      const alreadyApplied =
        !rescanRequired &&
        record.scan.appliedEpoch === record.epoch &&
        isEqual(compact(record.scan.birthday ?? {}), compact(birthday));
      writeAccount(state, accountId, {
        ...record,
        vkFp,
        epoch,
        scan: {
          ...record.scan,
          intent: 'on',
          operation: undefined,
          appliedEpoch: alreadyApplied ? epoch : undefined,
          forceRescan: rescanRequired || undefined,
          birthday,
        },
      });
      Object.keys(state.accounts).forEach((otherId) => {
        if (otherId === accountId) return;
        const other = readAccount(state, otherId);
        if (other?.networkId !== networkId || other.vkFp !== vkFp) return;
        writeAccount(state, otherId, {
          ...other,
          epoch,
          scan: {
            ...other.scan,
            birthday,
            appliedEpoch: alreadyApplied ? epoch : undefined,
            forceRescan: rescanRequired || undefined,
          },
        });
      });
      applied = true;
    });
    if (!committed) {
      throw new OneKeyLocalError(
        'xmr: privacy authorization could not be persisted',
      );
    }
    return applied;
  }

  async completeXmrPreparation({
    accountId,
    epoch,
  }: {
    accountId: string;
    epoch: string;
  }): Promise<void> {
    const committed = await this.update((state) => {
      const record = readAccount(state, accountId);
      if (
        !record ||
        record.scan.deletion ||
        record.epoch !== epoch ||
        record.scan.intent !== 'on' ||
        record.scan.operation
      )
        return;
      Object.keys(state.accounts).forEach((otherId) => {
        const other = readAccount(state, otherId);
        if (
          other?.networkId !== record.networkId ||
          other.scan.deletion ||
          other.vkFp !== record.vkFp ||
          other.epoch !== epoch
        )
          return;
        writeAccount(state, otherId, {
          ...other,
          scan: { ...other.scan, appliedEpoch: epoch, forceRescan: undefined },
        });
      });
    });
    if (!committed)
      throw new OneKeyLocalError(
        'xmr: scan preparation could not be persisted',
      );
  }

  /** Journal intent first: a crash here is resumed by resumePendingOperations. */
  async beginXmrEnable({
    networkId,
    accountId,
    birthdayHeight,
    birthdaySource,
    birthdayTimestamp,
  }: {
    networkId: string;
    accountId: string;
    birthdayHeight: number;
    birthdaySource?: string;
    birthdayTimestamp?: number;
  }): Promise<void> {
    const committed = await this.update((state) => {
      const record = readOrCreateAccount(state, { networkId, accountId });
      writeAccount(state, accountId, {
        ...record,
        scan: {
          ...record.scan,
          intent: 'on',
          operation: { type: 'enable', startedAt: Date.now() },
          birthday: {
            height: birthdayHeight,
            source: birthdaySource,
            timestamp: birthdayTimestamp,
          },
        },
      });
    });
    if (!committed) {
      throw new OneKeyLocalError(
        'xmr: privacy authorization could not be persisted',
      );
    }
  }

  async completeXmrEnable({
    accountId,
    birthdayHeight,
    vkFp,
  }: {
    accountId: string;
    birthdayHeight?: number;
    vkFp?: string;
  }): Promise<void> {
    const committed = await this.update((state) => {
      const record = readAccount(state, accountId);
      if (!record) {
        throw new OneKeyLocalError(
          'xmr: privacy enable operation is not pending',
        );
      }
      if (
        vkFp !== undefined &&
        record.vkFp !== undefined &&
        record.vkFp !== vkFp
      ) {
        throw new OneKeyLocalError(
          'xmr: viewing identity does not match this account',
        );
      }
      if (record.scan.operation?.type !== 'enable') {
        throw new OneKeyLocalError(
          'xmr: privacy enable operation is not pending',
        );
      }
      const height = birthdayHeight ?? record.scan.birthday?.height;
      writeAccount(state, accountId, {
        ...record,
        vkFp: vkFp ?? record.vkFp,
        scan: {
          ...record.scan,
          intent: 'on',
          operation: undefined,
          birthday:
            height === undefined
              ? undefined
              : { ...record.scan.birthday, height },
        },
      });
    });
    if (!committed) {
      throw new OneKeyLocalError(
        'xmr: privacy authorization could not be persisted',
      );
    }
  }

  async saveXmrDisabledAccount({
    accountId,
    resumeFromHeight,
  }: {
    accountId: string;
    resumeFromHeight?: number;
  }): Promise<void> {
    const committed = await this.update((state) => {
      const record = readAccount(state, accountId);
      if (!record) return;
      writeAccount(state, accountId, {
        ...record,
        scan: {
          ...record.scan,
          intent: 'off',
          operation: undefined,
          resumeFromHeight: resumeFromHeight ?? record.scan.resumeFromHeight,
        },
      });
    });
    if (!committed)
      throw new OneKeyLocalError(
        'xmr: privacy configuration could not be persisted',
      );
  }

  async beginXmrDisable({
    accountId,
    resumeFromHeight,
  }: {
    accountId: string;
    resumeFromHeight?: number;
  }): Promise<void> {
    await this.update((state) => {
      const record = readAccount(state, accountId);
      if (!record) return;
      writeAccount(state, accountId, {
        ...record,
        scan: {
          ...record.scan,
          operation: { type: 'disable', startedAt: Date.now() },
          resumeFromHeight: resumeFromHeight ?? record.scan.resumeFromHeight,
        },
      });
    });
  }

  async completeXmrDisable({
    accountId,
    expectedState,
  }: {
    accountId: string;
    expectedState?: IXmrAccountScanState;
  }): Promise<void> {
    const committed = await this.update((state) => {
      const record = readAccount(state, accountId);
      if (!record) return;
      if (
        expectedState &&
        (record.epoch !== expectedState.epoch ||
          record.scan.intent !== expectedState.intent ||
          !isEqual(record.scan.operation, expectedState.operation))
      )
        return;
      writeAccount(state, accountId, {
        ...record,
        scan: { ...record.scan, intent: 'off', operation: undefined },
      });
    });
    if (!committed)
      throw new OneKeyLocalError(
        'xmr: privacy configuration could not be persisted',
      );
  }

  async updateXmrBirthday({
    accountId,
    birthdayHeight,
    birthdayTimestamp,
    birthdaySource,
    expectedState,
  }: {
    accountId: string;
    birthdayHeight: number;
    birthdayTimestamp?: number;
    birthdaySource?: string;
    expectedState?: IXmrAccountScanState;
  }): Promise<void> {
    await this.update((state) => {
      const record = readAccount(state, accountId);
      if (!record) return;
      if (
        expectedState &&
        ((expectedState.epoch !== undefined &&
          record.epoch !== expectedState.epoch) ||
          record.scan.intent !== expectedState.intent ||
          record.scan.operation !== undefined ||
          record.scan.birthday?.height !== expectedState.birthdayHeight ||
          record.scan.birthday?.timestamp !== expectedState.birthdayTimestamp ||
          record.scan.birthday?.source !== expectedState.birthdaySource)
      )
        return;
      Object.keys(state.accounts).forEach((otherId) => {
        const other = readAccount(state, otherId);
        if (!other) return;
        if (
          otherId !== accountId &&
          (record.vkFp === undefined ||
            other.networkId !== record.networkId ||
            other.vkFp !== record.vkFp)
        )
          return;
        writeAccount(state, otherId, {
          ...other,
          scan: {
            ...other.scan,
            birthday: {
              height: birthdayHeight,
              source: birthdaySource ?? record.scan.birthday?.source,
              timestamp: birthdayTimestamp,
            },
          },
        });
      });
    });
  }

  async listXmrPendingOperations({
    networkId,
    startedBefore,
  }: {
    networkId: string;
    startedBefore?: number;
  }): Promise<{ accountId: string; state: IXmrAccountScanState }[]> {
    return (await this.listNetworkRecords(networkId)).flatMap(
      ({ accountId, record }) =>
        record.scan.operation !== undefined &&
        (startedBefore === undefined ||
          record.scan.operation.startedAt < startedBefore)
          ? [{ accountId, state: buildXmrView(record) }]
          : [],
    );
  }

  async listXmrEnabledAccountIds({
    networkId,
  }: {
    networkId: string;
  }): Promise<string[]> {
    return (await this.listNetworkRecords(networkId)).flatMap(
      ({ accountId, record }) => (isScanning(record) ? [accountId] : []),
    );
  }
}
