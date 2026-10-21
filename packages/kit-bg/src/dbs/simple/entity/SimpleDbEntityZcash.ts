import { isEqual } from 'lodash';
import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

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

export type IZcashPrivacyModeOperation =
  | {
      type: 'enable';
      requestedAt: number;
    }
  | {
      type: 'disable';
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

// Viewing-level Zcash account metadata (exposure equivalent to an xpub);
// local-only, never cloud-synced. The spending key is re-derived from the
// mnemonic at sign time, never stored here.
export interface IZcashAccountMeta {
  ufvk: string;
  unifiedAddress: string;
  // Hardware only: the app's own derivation when it differs from the
  // device-displayed address (the device UA also carries P2PKH).
  derivedUnifiedAddress?: string;
  transparentAddress: string;
  // App-owned address derivation policy version, independent of pool upgrades.
  addressSchemeVersion?: number;
  seedFingerprintHex: string;
  hdIndex: number;
  // Fixed when privacy mode is enabled so re-scans stay stable.
  birthdayHeight?: number;
  birthdaySource?: IZcashBirthdaySource;
  // Diagnostic input only, not a second scan cursor -- birthdayHeight is the
  // sole scanner authority.
  birthdayTimestamp?: number;
  createdAt: number;
}

export interface IZcashDB {
  accounts: Record<string, IZcashAccountMeta>;
  // A missing record means off.
  privacyModeAccounts?: Record<string, IZcashPrivacyModeState>;
  // Per-wallet: true only for a freshly generated mnemonic. Absent means not
  // proven fresh -- the safe default for the birthday decision.
  walletFreshMnemonic?: Record<string, boolean>;
  // Recorded at wallet creation only; used to recommend a recovery month on opt-in.
  walletCreatedAtTimestamps?: Record<string, number>;
  // Hardware wallets: ZIP-32 seed fingerprint the device reported (one per
  // seed, so per wallet). Transparent PCZTs carry it; the firmware rejects a
  // mismatch. An identifier, not viewing material: it survives privacy-mode
  // off and local-data deletion.
  walletSeedFingerprints?: Record<string, string>;
  // Durable repair journal: resumes a process death between purging the
  // wasm cache and saving the new birthday.
  pendingRescans?: Record<string, IZcashPendingRescan>;
}

const zcashStoredDataSchema = z
  .object({
    accounts: z.record(
      z
        .object({
          ufvk: z.string().min(1),
          unifiedAddress: z.string().min(1),
          derivedUnifiedAddress: z.string().min(1).optional(),
          transparentAddress: z.string().min(1),
          addressSchemeVersion: z.number().int().nonnegative().optional(),
          seedFingerprintHex: z.string().min(1),
          hdIndex: z.number().int().nonnegative(),
          birthdayHeight: z.number().int().nonnegative().optional(),
          createdAt: z.number().finite(),
        })
        .passthrough(),
    ),
    privacyModeAccounts: z
      .record(z.object({ intent: z.enum(['on', 'off']) }).passthrough())
      .optional(),
    walletFreshMnemonic: z.record(z.boolean()).optional(),
    walletCreatedAtTimestamps: z.record(z.number().finite()).optional(),
    walletSeedFingerprints: z
      .record(z.string().regex(/^[0-9a-f]{64}$/))
      .optional(),
    pendingRescans: z.record(z.object({}).passthrough()).optional(),
  })
  .passthrough();

export class SimpleDbEntityZcash extends SimpleDbEntityBase<IZcashDB> {
  entityName = 'zcash';

  override enableCache = false;

  // Viewing identity, recovery bounds and approvals are not disposable caches.
  protected override readonly enableUnreadableRecordSelfHeal = false;

  protected override readonly rejectInvalidStoredData = true;

  protected override validateStoredData(data: unknown): void {
    if (!zcashStoredDataSchema.safeParse(data).success) {
      throw new OneKeyLocalError('simpledb: invalid persisted data (zcash)');
    }
  }

  async saveAccountMeta({
    accountId,
    meta,
    expectedPrivacyModeState,
    expectedMeta,
  }: {
    accountId: string;
    meta: IZcashAccountMeta;
    expectedPrivacyModeState?: IZcashPrivacyModeStateView;
    expectedMeta?: IZcashAccountMeta;
  }) {
    // setRawData replaces the whole record (no implicit merge) -- every
    // method here must spread ...rawData first or it silently wipes other
    // top-level keys.
    await this.setRawData((rawData) => {
      const privacyModeState = rawData?.privacyModeAccounts?.[accountId];
      if (
        (expectedPrivacyModeState !== undefined &&
          !isEqual(privacyModeState, expectedPrivacyModeState)) ||
        (expectedMeta !== undefined &&
          !isEqual(rawData?.accounts?.[accountId], expectedMeta))
      ) {
        throw new OneKeyLocalError('zcash: privacy state changed during setup');
      }
      return {
        ...rawData,
        accounts: {
          ...rawData?.accounts,
          [accountId]: meta,
        },
        privacyModeAccounts: privacyModeState
          ? {
              ...rawData?.privacyModeAccounts,
              [accountId]: {
                ...privacyModeState,
                birthdayHeight: meta.birthdayHeight,
                birthdaySource: meta.birthdaySource,
                birthdayTimestamp: meta.birthdayTimestamp,
                updatedAt: Date.now(),
              },
            }
          : rawData?.privacyModeAccounts,
      };
    });
  }

  async getPrivacyModeState({
    accountId,
  }: {
    accountId: string;
  }): Promise<IZcashPrivacyModeStateView> {
    const rawData = await this.getRawData();
    return rawData?.privacyModeAccounts?.[accountId] ?? { intent: 'off' };
  }

  async initializePrivacyModeOff({
    accountId,
    birthdayMonthHint,
  }: {
    accountId: string;
    birthdayMonthHint?: IZcashBirthdayMonthHint;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      if (rawData?.privacyModeAccounts?.[accountId]) {
        return rawData;
      }
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        privacyModeAccounts: {
          ...rawData?.privacyModeAccounts,
          [accountId]: {
            intent: 'off',
            birthdayMonthHint,
            updatedAt: Date.now(),
          },
        },
      };
    });
  }

  async backfillPrivacyModeBirthdayMonthHint({
    accountIds,
    birthdayMonthHint,
  }: {
    accountIds: string[];
    birthdayMonthHint: IZcashBirthdayMonthHint;
  }): Promise<void> {
    if (accountIds.length === 0) {
      return;
    }
    const accountIdSet = new Set(accountIds);
    await this.setRawData((rawData) => {
      const privacyModeAccounts = { ...rawData?.privacyModeAccounts };
      let changed = false;
      for (const [accountId, state] of Object.entries(privacyModeAccounts)) {
        if (accountIdSet.has(accountId) && !state.birthdayMonthHint) {
          privacyModeAccounts[accountId] = {
            ...state,
            birthdayMonthHint,
            updatedAt: Date.now(),
          };
          changed = true;
        }
      }
      return changed
        ? {
            ...rawData,
            accounts: rawData?.accounts ?? {},
            privacyModeAccounts,
          }
        : { ...rawData, accounts: rawData?.accounts ?? {} };
    });
  }

  async beginPrivacyModeEnable({
    accountId,
    birthdayHeight,
    birthdayTimestamp,
    resetResumeFromHeight = false,
  }: {
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
    await this.setRawData((rawData) => {
      const current = rawData?.privacyModeAccounts?.[accountId];
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        privacyModeAccounts: {
          ...rawData?.privacyModeAccounts,
          [accountId]: {
            ...current,
            intent: 'off',
            birthdayHeight,
            birthdayTimestamp,
            ...(resetResumeFromHeight
              ? {
                  resumeFromHeight: undefined,
                  scanExcludedFromHeight: undefined,
                }
              : {}),
            birthdayMonthHint:
              current?.birthdayMonthHint ??
              (birthdayTimestamp !== undefined
                ? {
                    timestamp: birthdayTimestamp,
                    source: 'imported-wallet',
                  }
                : undefined),
            operation: {
              type: 'enable',
              requestedAt: Date.now(),
            },
            updatedAt: Date.now(),
          },
        },
      };
    });
  }

  async completePrivacyModeEnable({
    accountId,
    maxEnabledAccounts,
  }: {
    accountId: string;
    maxEnabledAccounts?: number;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const current = rawData?.privacyModeAccounts?.[accountId];
      if (current?.operation?.type !== 'enable') {
        throw new OneKeyLocalError(
          'zcash: privacy enable operation is not pending',
        );
      }
      if (maxEnabledAccounts !== undefined) {
        const targetKey = rawData?.accounts?.[accountId]?.ufvk;
        if (!targetKey) {
          throw new OneKeyLocalError(
            'zcash: viewing identity missing during enable',
          );
        }
        const enabledKeys = new Set(
          Object.entries(rawData?.privacyModeAccounts ?? {}).flatMap(
            ([id, state]) => {
              const ufvk = rawData?.accounts?.[id]?.ufvk;
              return state.intent === 'on' &&
                state.operation === undefined &&
                ufvk
                ? [ufvk]
                : [];
            },
          ),
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
      const { operation: _operation, ...retained } = current;
      const { resumeFromHeight: _resumeFromHeight, ...completed } = retained;
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        privacyModeAccounts: {
          ...rawData?.privacyModeAccounts,
          [accountId]: {
            ...completed,
            intent: 'on',
            updatedAt: Date.now(),
          },
        },
      };
    });
  }

  async markPrivacyModeScanExcluded({
    accountId,
    fromHeight,
  }: {
    accountId: string;
    fromHeight: number;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const state = rawData?.privacyModeAccounts?.[accountId];
      if (
        !state ||
        state.intent !== 'on' ||
        state.operation !== undefined ||
        state.scanExcludedFromHeight !== undefined
      ) {
        return rawData ?? { accounts: {} };
      }
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        privacyModeAccounts: {
          ...rawData?.privacyModeAccounts,
          [accountId]: {
            ...state,
            scanExcludedFromHeight: fromHeight,
            updatedAt: Date.now(),
          },
        },
      };
    });
  }

  async clearPrivacyModeScanExcluded({
    accountId,
    expectedFromHeight,
  }: {
    accountId: string;
    expectedFromHeight: number;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const state = rawData?.privacyModeAccounts?.[accountId];
      if (state?.scanExcludedFromHeight !== expectedFromHeight) {
        return rawData ?? { accounts: {} };
      }
      const { scanExcludedFromHeight: _excluded, ...retained } = state;
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        privacyModeAccounts: {
          ...rawData?.privacyModeAccounts,
          [accountId]: { ...retained, updatedAt: Date.now() },
        },
      };
    });
  }

  async beginPrivacyModeDisable({
    accountId,
    resumeFromHeight,
  }: {
    accountId: string;
    resumeFromHeight: number;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const current = rawData?.privacyModeAccounts?.[accountId];
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        privacyModeAccounts: {
          ...rawData?.privacyModeAccounts,
          [accountId]: {
            ...current,
            intent: 'off',
            resumeFromHeight,
            operation: {
              type: 'disable',
              requestedAt: Date.now(),
            },
            updatedAt: Date.now(),
          },
        },
      };
    });
  }

  async completePrivacyModeDisable({
    accountId,
  }: {
    accountId: string;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const current = rawData?.privacyModeAccounts?.[accountId];
      if (!current) {
        return {
          ...rawData,
          accounts: rawData?.accounts ?? {},
        };
      }
      const { operation: _operation, ...retained } = current;
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        privacyModeAccounts: {
          ...rawData?.privacyModeAccounts,
          [accountId]: {
            ...retained,
            intent: 'off',
            updatedAt: Date.now(),
          },
        },
      };
    });
  }

  async listPendingPrivacyModeDisables(options?: {
    requestedBefore?: number;
  }): Promise<string[]> {
    const rawData = await this.getRawData();
    return Object.entries(rawData?.privacyModeAccounts ?? {}).flatMap(
      ([accountId, state]) =>
        state.operation?.type === 'disable' &&
        (options?.requestedBefore === undefined ||
          state.operation.requestedAt < options.requestedBefore)
          ? [accountId]
          : [],
    );
  }

  async cancelPendingPrivacyModeEnables(options?: {
    accountId?: string;
    requestedBefore?: number;
  }): Promise<string[]> {
    const cancelledAccountIds: string[] = [];
    await this.setRawData((rawData) => {
      const privacyModeAccounts = { ...rawData?.privacyModeAccounts };
      for (const [accountId, state] of Object.entries(privacyModeAccounts)) {
        if (
          state.operation?.type === 'enable' &&
          (options?.accountId === undefined ||
            options.accountId === accountId) &&
          (options?.requestedBefore === undefined ||
            state.operation.requestedAt < options.requestedBefore)
        ) {
          const { operation: _operation, ...retained } = state;
          privacyModeAccounts[accountId] = {
            ...retained,
            intent: 'off',
            updatedAt: Date.now(),
          };
          cancelledAccountIds.push(accountId);
        }
      }
      return cancelledAccountIds.length > 0
        ? {
            ...rawData,
            accounts: rawData?.accounts ?? {},
            privacyModeAccounts,
          }
        : { ...rawData, accounts: rawData?.accounts ?? {} };
    });
    return cancelledAccountIds;
  }

  async isPrivacyModeEnabled({
    accountId,
  }: {
    accountId: string;
  }): Promise<boolean> {
    const state = await this.getPrivacyModeState({ accountId });
    return state.intent === 'on' && state.operation === undefined;
  }

  async listPrivacyModeEnabledAccountIds(): Promise<string[]> {
    const rawData = await this.getRawData();
    return Object.entries(rawData?.privacyModeAccounts ?? {}).flatMap(
      ([accountId, state]) =>
        state.intent === 'on' && state.operation === undefined
          ? [accountId]
          : [],
    );
  }

  async listPrivacyModeAccountIds(): Promise<string[]> {
    const rawData = await this.getRawData();
    return Object.keys(rawData?.privacyModeAccounts ?? {});
  }

  async listActiveViewingKeys(): Promise<string[]> {
    const rawData = await this.getRawData();
    const activeViewingKeys = Object.entries(
      rawData?.privacyModeAccounts ?? {},
    ).flatMap(([accountId, state]) => {
      const meta = rawData?.accounts?.[accountId];
      return state.intent === 'on' &&
        state.operation === undefined &&
        meta?.ufvk
        ? [meta.ufvk]
        : [];
    });
    return Array.from(new Set(activeViewingKeys)).toSorted();
  }

  async getAccountMeta({
    accountId,
  }: {
    accountId: string;
  }): Promise<IZcashAccountMeta | undefined> {
    const rawData = await this.getRawData();
    return rawData?.accounts?.[accountId];
  }

  async listAccountIds(): Promise<string[]> {
    const rawData = await this.getRawData();
    return Object.keys(rawData?.accounts ?? {});
  }

  async listCleanupAccountIds(): Promise<string[]> {
    const rawData = await this.getRawData();
    return Array.from(
      new Set([
        ...Object.keys(rawData?.accounts ?? {}),
        ...Object.keys(rawData?.privacyModeAccounts ?? {}),
        ...Object.keys(rawData?.pendingRescans ?? {}),
      ]),
    );
  }

  async listAccountMetas(): Promise<
    { accountId: string; meta: IZcashAccountMeta }[]
  > {
    const rawData = await this.getRawData();
    return Object.entries(rawData?.accounts ?? {}).map(([accountId, meta]) => ({
      accountId,
      meta,
    }));
  }

  async removeAccountMeta({ accountId }: { accountId: string }) {
    await this.setRawData((rawData) => {
      const accounts = { ...rawData?.accounts };
      const pendingRescans = { ...rawData?.pendingRescans };
      delete accounts[accountId];
      delete pendingRescans[accountId];
      // The resume cursor points into the cache this call deletes, so it
      // goes too; the birthday stays so re-enabling reuses the month.
      const privacyModeAccounts = { ...rawData?.privacyModeAccounts };
      const current = privacyModeAccounts[accountId];
      if (current?.resumeFromHeight !== undefined) {
        const { resumeFromHeight: _cursor, ...retained } = current;
        privacyModeAccounts[accountId] = {
          ...retained,
          updatedAt: Date.now(),
        };
      }
      return { ...rawData, accounts, pendingRescans, privacyModeAccounts };
    });
  }

  async removeAccountState({ accountId }: { accountId: string }) {
    await this.setRawData((rawData) => {
      const accounts = { ...rawData?.accounts };
      const pendingRescans = { ...rawData?.pendingRescans };
      const privacyModeAccounts = { ...rawData?.privacyModeAccounts };
      delete accounts[accountId];
      delete pendingRescans[accountId];
      delete privacyModeAccounts[accountId];
      return {
        ...rawData,
        accounts,
        pendingRescans,
        privacyModeAccounts,
      };
    });
  }

  async getWalletFreshMnemonic({
    walletId,
  }: {
    walletId: string;
  }): Promise<boolean | undefined> {
    const rawData = await this.getRawData();
    return rawData?.walletFreshMnemonic?.[walletId];
  }

  async saveWalletCreationProvenance({
    walletId,
    isFreshlyGeneratedMnemonic,
    createdAt,
  }: {
    walletId: string;
    isFreshlyGeneratedMnemonic: boolean;
    createdAt: number;
  }) {
    await this.setRawData((rawData) => ({
      ...rawData,
      accounts: rawData?.accounts ?? {},
      walletFreshMnemonic: {
        ...rawData?.walletFreshMnemonic,
        [walletId]: isFreshlyGeneratedMnemonic,
      },
      walletCreatedAtTimestamps: isFreshlyGeneratedMnemonic
        ? {
            ...rawData?.walletCreatedAtTimestamps,
            [walletId]:
              rawData?.walletCreatedAtTimestamps?.[walletId] ?? createdAt,
          }
        : rawData?.walletCreatedAtTimestamps,
    }));
  }

  async getWalletCreatedAtTimestamp({
    walletId,
  }: {
    walletId: string;
  }): Promise<number | undefined> {
    const rawData = await this.getRawData();
    return rawData?.walletCreatedAtTimestamps?.[walletId];
  }

  async getWalletSeedFingerprint({
    walletId,
  }: {
    walletId: string;
  }): Promise<string | undefined> {
    const rawData = await this.getRawData();
    return rawData?.walletSeedFingerprints?.[walletId];
  }

  async saveWalletSeedFingerprint({
    walletId,
    seedFingerprintHex,
  }: {
    walletId: string;
    seedFingerprintHex: string;
  }) {
    const normalized = seedFingerprintHex.toLowerCase();
    await this.setRawData((rawData) => ({
      ...rawData,
      accounts: rawData?.accounts ?? {},
      walletSeedFingerprints: {
        ...rawData?.walletSeedFingerprints,
        [walletId]: normalized,
      },
    }));
  }

  async removeWalletState({ walletId }: { walletId: string }) {
    await this.setRawData((rawData) => {
      const walletFreshMnemonic = { ...rawData?.walletFreshMnemonic };
      const walletCreatedAtTimestamps = {
        ...rawData?.walletCreatedAtTimestamps,
      };
      const walletSeedFingerprints = { ...rawData?.walletSeedFingerprints };
      delete walletFreshMnemonic[walletId];
      delete walletCreatedAtTimestamps[walletId];
      delete walletSeedFingerprints[walletId];
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        walletFreshMnemonic,
        walletCreatedAtTimestamps,
        walletSeedFingerprints,
      };
    });
  }

  async listWalletStateIds(): Promise<string[]> {
    const rawData = await this.getRawData();
    return Array.from(
      new Set([
        ...Object.keys(rawData?.walletFreshMnemonic ?? {}),
        ...Object.keys(rawData?.walletCreatedAtTimestamps ?? {}),
        ...Object.keys(rawData?.walletSeedFingerprints ?? {}),
      ]),
    );
  }

  async listPendingRescans(): Promise<
    { accountId: string; repair: IZcashPendingRescan }[]
  > {
    const rawData = await this.getRawData();
    return Object.entries(rawData?.pendingRescans ?? {}).map(
      ([accountId, repair]) => ({ accountId, repair }),
    );
  }

  async savePendingRescan({
    accountId,
    repair,
  }: {
    accountId: string;
    repair: IZcashPendingRescan;
  }) {
    await this.setRawData((rawData) => ({
      ...rawData,
      accounts: rawData?.accounts ?? {},
      pendingRescans: {
        ...rawData?.pendingRescans,
        [accountId]: repair,
      },
    }));
  }

  async removePendingRescan({
    accountId,
    expectedRepair,
  }: {
    accountId: string;
    expectedRepair?: IZcashPendingRescan;
  }) {
    await this.setRawData((rawData) => {
      if (
        expectedRepair !== undefined &&
        !isEqual(rawData?.pendingRescans?.[accountId], expectedRepair)
      ) {
        return rawData ?? { accounts: {} };
      }
      const pendingRescans = { ...rawData?.pendingRescans };
      delete pendingRescans[accountId];
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        pendingRescans,
      };
    });
  }
}
