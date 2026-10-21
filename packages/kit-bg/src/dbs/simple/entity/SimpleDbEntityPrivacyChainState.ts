import { isEqual, isPlainObject, uniq } from 'lodash';
import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Scan state of every privacy chain account, the wallet facts it needs, and
// the device-wide settings. Read on every scan turn, so it stays small: keys,
// journals and caches live in their own entities. Evolve the record schema
// additively (new optional fields only): an older bundle after a hot-update
// rollback reads a record it can't parse as off.

// ---------------------------------------------------------------------------
// Chain views. Callers keep these shapes; the record below is what is stored.

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

// Viewing-level Zcash account metadata (exposure equivalent to an xpub). The
// UFVK itself lives in the viewing key store; the spending key is re-derived
// from the mnemonic at sign time.
export interface IZcashAccountMeta {
  // Fingerprint of the account's UFVK: the key read back must match it.
  vkFp: string;
  unifiedAddress: string;
  // Hardware only: the app's own derivation when it differs from the
  // device-displayed address (the device UA also carries P2PKH).
  derivedUnifiedAddress?: string;
  transparentAddress: string;
  // App-owned address derivation policy version, independent of pool upgrades.
  addressSchemeVersion?: number;
  // One per wallet; see IPrivacyChainWalletRecord.
  seedFingerprintHex: string;
  // Names the runtime account even after the app account row is gone.
  hdIndex: number;
  // Fixed when privacy mode is enabled so re-scans stay stable.
  birthdayHeight?: number;
  birthdaySource?: IZcashBirthdaySource;
  // Diagnostic input only, not a second scan cursor -- birthdayHeight is the
  // sole scanner authority.
  birthdayTimestamp?: number;
  createdAt: number;
}

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

// ---------------------------------------------------------------------------
// Stored records. Each one is validated on its own when read: a malformed
// record reads as "not enabled, needs repair" and never stops the others.

const finiteNumber = z.number().finite();

const birthdaySchema = z.object({
  height: finiteNumber,
  source: z.string().min(1).optional(),
  timestamp: finiteNumber.optional(),
});

const accountRecordSchema = z.object({
  networkId: z.string().min(1),
  walletId: z.string(),
  // See vaults/localWallet/viewingKeyFingerprint.ts. The reference identity:
  // a key read or derived for this account must carry the same value. Absent
  // until the first key is derived.
  vkFp: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .optional(),
  // Random 64-bit hex, renewed whenever scanned data is destroyed, so a cache
  // written for older data can tell it is stale.
  epoch: z.string().regex(/^[0-9a-f]{16}$/),
  scan: z.object({
    intent: z.enum(['on', 'off']),
    // Enable/disable journal; a crash leaves it for the next start to settle.
    operation: z
      .object({
        type: z.enum(['enable', 'disable']),
        startedAt: finiteNumber,
      })
      .optional(),
    // The resolved birthday: the only copy, and the scanner's start.
    birthday: birthdaySchema.optional(),
    // Zcash: what the latest enable asked for, until setup resolves it into
    // `birthday`. Kept after a failed enable so a retry asks for the same.
    birthdayRequest: z
      .object({
        height: finiteNumber.optional(),
        timestamp: finiteNumber.optional(),
      })
      .optional(),
    resumeFromHeight: finiteNumber.optional(),
    // Zcash repair journal: resumes a process death between purging the
    // scanned data and saving the new birthday. Separate from `operation`
    // because an enable can run a rescan while its own journal is open.
    rescan: z
      .object({
        birthday: birthdaySchema.extend({ source: z.string().min(1) }),
        requestedAt: finiteNumber,
      })
      .optional(),
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

const walletRecordSchema = z.object({
  // True only for a freshly generated mnemonic. Absent means not proven
  // fresh -- the safe default for the birthday decision.
  freshMnemonic: z.boolean().optional(),
  // Recorded at wallet creation only; recommends a recovery month on opt-in.
  createdAt: finiteNumber.optional(),
  chain: z
    .object({
      // ZIP-32 seed fingerprint: one seed per wallet. Transparent PCZTs carry
      // it and the firmware rejects a mismatch. An identifier, not viewing
      // material: it survives privacy-mode off and local-data deletion.
      zcash: z
        .object({ seedFingerprintHex: z.string().regex(/^[0-9a-f]{64}$/) })
        .optional(),
    })
    .optional(),
});

export type IPrivacyChainWalletRecord = z.infer<typeof walletRecordSchema>;

export interface IPrivacyChainStateDB {
  // Device-wide, not per network: it is about this device's data plan.
  device?: { allowCellularSync?: boolean };
  // Networks whose scan database an app reset failed to delete. Rewritten
  // after the reset clears this store; the next launch and the next reset
  // retry them.
  pendingLocalDataDrop?: string[];
  // Networks whose runtime may hold an account nothing names any more (its
  // key was unreadable when the account went). Cleared by a full orphan purge
  // or a drop of that network's database.
  runtimeOrphans?: string[];
  // walletId -> IPrivacyChainWalletRecord
  wallets?: Record<string, unknown>;
  // accountId -> IPrivacyChainAccountRecord. Only accounts that were ever
  // enabled have one; a missing record means off.
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
  return result.success ? compact(result.data) : undefined;
}

function parseWalletRecord(
  raw: unknown,
): IPrivacyChainWalletRecord | undefined {
  const result = walletRecordSchema.safeParse(raw);
  return result.success ? compact(result.data) : undefined;
}

// Builders write only what the schema knows; a record that would not read
// back is refused here instead of reading as "off" later.
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

// A malformed record may still name its network; one that does not is
// counted under every network, so cleanup and the keep-set still see it.
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

// The runtime keeps this account's scan data: scanning, mid-operation,
// paused with a resume position, or mid-rescan.
function holdsScanData(record: IPrivacyChainAccountRecord): boolean {
  return (
    record.scan.intent === 'on' ||
    record.scan.operation !== undefined ||
    record.scan.resumeFromHeight !== undefined ||
    record.scan.rescan !== undefined
  );
}

function isScanning(record: IPrivacyChainAccountRecord): boolean {
  return record.scan.intent === 'on' && record.scan.operation === undefined;
}

// The identity a Zcash account holds a slot with, counted once setup stored
// its addresses and fingerprint.
function zcashRecordVkFp(
  record: IPrivacyChainAccountRecord | undefined,
): string | undefined {
  return record?.chain?.zcash ? record.vkFp : undefined;
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
): IZcashPrivacyModeStateView {
  const { scan } = record;
  const request = scan.birthdayRequest;
  const birthdayHeight = request ? request.height : scan.birthday?.height;
  const birthdayTimestamp = request
    ? request.timestamp
    : scan.birthday?.timestamp;
  return compact({
    intent: scan.intent,
    birthdayHeight,
    birthdaySource: scan.birthday?.source as IZcashBirthdaySource | undefined,
    birthdayTimestamp,
    // A fresh wallet recommends its creation month; otherwise the month this
    // account was last asked to start from.
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

// A CAS compares what the caller acted on; `updatedAt` also moves on writes
// that change none of it (epoch rotation, rescan journal).
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

// A malformed record reads as absent and is replaced: it names nothing a new
// enable could keep.
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

  // Only the container shape is checked here; records are checked on read.
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

  // Each account's epoch as this runtime last knew it (undefined: no
  // record). It runs ahead of disk while a destructive operation is in
  // flight, so a cache write checked against it is refused from the moment
  // that operation starts. Absent: not read yet.
  private readonly epochMirror = new Map<string, string | undefined>();

  // Bumped on every change, so a read from disk can tell it was overtaken.
  private epochMirrorVersion = 0;

  private setMirroredEpoch(accountId: string, epoch: string | undefined) {
    this.epochMirror.set(accountId, epoch);
    this.epochMirrorVersion += 1;
  }

  private async update(build: (state: IMutableState) => void): Promise<void> {
    await this.setRawData((raw) => {
      const state: IMutableState = {
        device: raw?.device,
        pendingLocalDataDrop: raw?.pendingLocalDataDrop,
        runtimeOrphans: raw?.runtimeOrphans,
        wallets: { ...raw?.wallets },
        accounts: { ...raw?.accounts },
      };
      build(state);
      // Before the write is persisted; records left untouched keep theirs.
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

  // -------------------------------------------------------------------------
  // Device

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

  // Removes only the given networks: a reset may have marked others since
  // they were read.
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

  // -------------------------------------------------------------------------
  // Wallets

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

  // -------------------------------------------------------------------------
  // Accounts, any chain

  // Every record of the network, malformed ones included, so removed-account
  // cleanup reaches them.
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

  // Accounts whose scan data the runtime keeps. A malformed record may be
  // one of them. Undefined when nothing was read (no state yet, or masked by
  // Travel Mode): never the same as none. Any state at all (a device
  // setting, a wallet fact) gives [] instead, so [] is not proof by itself
  // that the runtime holds nothing.
  async listScanDataAccountIds({
    networkId,
  }: {
    networkId: string;
  }): Promise<string[] | undefined> {
    const raw = await this.getRawData();
    if (!raw) return undefined;
    return uniq(
      Object.entries(raw.accounts ?? {}).flatMap(([accountId, value]) => {
        if (!mayBelongToNetwork(value, networkId)) return [];
        const record = parseAccountRecord(value);
        return !record || holdsScanData(record) ? [accountId] : [];
      }),
    );
  }

  async removeAccount({ accountId }: { accountId: string }): Promise<void> {
    await this.update((state) => {
      delete state.accounts[accountId];
    });
  }

  // App Reset: the network's database is gone. Wallet facts stay; they do
  // not describe that database.
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
    // A masked store reads as empty, which is not "no record"; a mirror
    // change during the read is newer than what was read.
    if (raw && version === this.epochMirrorVersion) {
      this.setMirroredEpoch(accountId, epoch);
    }
    return this.epochMirror.has(accountId)
      ? this.epochMirror.get(accountId)
      : epoch;
  }

  // Travel Mode and App Reset: what is on disk is no longer this runtime's.
  async forgetAccountEpochs(): Promise<void> {
    this.epochMirror.clear();
    this.epochMirrorVersion += 1;
  }

  // Before scanned data is destroyed. The mirror moves first, so a cache
  // write racing the destruction is refused even before this is persisted.
  async rotateAccountEpochs({
    accountIds,
  }: {
    accountIds: string[];
  }): Promise<void> {
    if (accountIds.length === 0) return;
    const rotated = new Map(uniq(accountIds).map((id) => [id, createEpoch()]));
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

  // Delete-local-data: everything that points into the deleted scan data
  // goes, the identity included, so a later enable may set the account up
  // with whatever key it derives. Only the birthday stays, so that enable
  // reuses the month.
  async clearAccountScanData({
    accountId,
  }: {
    accountId: string;
  }): Promise<void> {
    await this.update((state) => {
      const record = readAccount(state, accountId);
      delete state.accounts[accountId];
      if (!record?.scan.birthday && !record?.scan.birthdayRequest) return;
      writeAccount(state, accountId, {
        networkId: record.networkId,
        walletId: record.walletId,
        epoch: createEpoch(),
        scan: {
          intent: 'off',
          birthday: record.scan.birthday,
          birthdayRequest: record.scan.birthdayRequest,
        },
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    });
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

  // -------------------------------------------------------------------------
  // Zcash

  async getZcashPrivacyModeState({
    accountId,
  }: {
    accountId: string;
  }): Promise<IZcashPrivacyModeStateView> {
    const raw = await this.getRawData();
    const record = parseAccountRecord(raw?.accounts?.[accountId]);
    if (record) {
      return buildZcashStateView(
        record,
        parseWalletRecord(raw?.wallets?.[record.walletId]),
      );
    }
    // Never enabled: a fresh wallet still recommends its creation month.
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
    await this.update((state) => {
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
  }

  async completeZcashPrivacyModeEnable({
    accountId,
    maxEnabledAccounts,
  }: {
    accountId: string;
    maxEnabledAccounts?: number;
  }): Promise<void> {
    await this.update((state) => {
      const current = readAccount(state, accountId);
      if (!current || current.scan.operation?.type !== 'enable') {
        throw new OneKeyLocalError(
          'zcash: privacy enable operation is not pending',
        );
      }
      if (maxEnabledAccounts !== undefined) {
        const targetKey = zcashRecordVkFp(current);
        if (!targetKey) {
          throw new OneKeyLocalError(
            'zcash: viewing identity missing during enable',
          );
        }
        const enabledKeys = new Set(
          Object.values(state.accounts).flatMap((value) => {
            const record = parseAccountRecord(value);
            const vkFp = zcashRecordVkFp(record);
            return record &&
              record.networkId === current.networkId &&
              isScanning(record) &&
              vkFp
              ? [vkFp]
              : [];
          }),
        );
        if (
          !enabledKeys.has(targetKey) &&
          enabledKeys.size >= maxEnabledAccounts
        ) {
          throw new OneKeyLocalError({
            message: `Privacy Mode is limited to ${maxEnabledAccounts} accounts at a time. Turn one off before enabling another.`,
            autoToast: true,
          });
        }
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
    await this.update((state) => {
      const record = readAccount(state, accountId);
      const zcash = record?.chain?.zcash;
      if (
        !record ||
        !zcash ||
        !isScanning(record) ||
        zcash.scanExcludedFromHeight !== undefined
      ) {
        return;
      }
      writeAccount(state, accountId, {
        ...record,
        chain: {
          ...record.chain,
          zcash: { ...zcash, scanExcludedFromHeight: fromHeight },
        },
      });
    });
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

  // Accounts with viewing metadata on disk, plus malformed records that may
  // have some.
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

  // Writes the viewing metadata and the resolved birthday it carries. The
  // expectations are compare-and-set guards against a concurrent delete,
  // repair or mode change.
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
    await this.update((state) => {
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
      // Viewing metadata only follows an enable, which creates the record.
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

  // Journaled before the scanned data is purged; the purge rotates the epoch.
  async saveZcashPendingRescan({
    accountId,
    repair,
  }: {
    accountId: string;
    repair: IZcashPendingRescan;
  }): Promise<void> {
    await this.update((state) => {
      const record = readAccount(state, accountId);
      if (!record) return;
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
    });
  }

  // With an expected repair, an older completion never consumes a newer one.
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

  // -------------------------------------------------------------------------
  // Monero

  async getXmrAccountState({
    accountId,
  }: {
    accountId: string;
  }): Promise<IXmrAccountScanState> {
    const found = await this.readAccountRecord(accountId);
    return found ? buildXmrView(found.record) : { intent: 'off' };
  }

  /**
   * Journal intent before doing work: a crash here is resumed by
   * resumePendingOperations, else the account would claim 'off' with a
   * database that already exists.
   */
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
    await this.update((state) => {
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
    await this.update((state) => {
      const record = readAccount(state, accountId);
      if (!record) return;
      if (
        vkFp !== undefined &&
        record.vkFp !== undefined &&
        record.vkFp !== vkFp
      ) {
        throw new OneKeyLocalError(
          'xmr: viewing identity does not match this account',
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

  // A rescan only ever moves the start earlier; the caller decides that.
  async updateXmrBirthday({
    accountId,
    birthdayHeight,
    birthdayTimestamp,
  }: {
    accountId: string;
    birthdayHeight: number;
    birthdayTimestamp?: number;
  }): Promise<void> {
    await this.update((state) => {
      const record = readAccount(state, accountId);
      if (!record) return;
      writeAccount(state, accountId, {
        ...record,
        scan: {
          ...record.scan,
          birthday: {
            height: birthdayHeight,
            source: record.scan.birthday?.source,
            timestamp: birthdayTimestamp,
          },
        },
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
