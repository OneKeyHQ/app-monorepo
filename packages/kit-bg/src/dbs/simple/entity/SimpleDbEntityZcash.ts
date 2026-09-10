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

export type IZcashTransparentOutpoint = { txid: string; vout: number };

export type IZcashTransparentReservation = {
  ownerId: string;
  createdAt: number;
  expiryHeight: number;
};

export type IZcashTransparentPendingTx = {
  ownerId: string;
  rawTx: string;
  txid: string;
  spentOutpoints: IZcashTransparentOutpoint[];
  expiryHeight: number;
  createdAt: number;
  broadcastState: 'accepted' | 'unknown';
};

export type IZcashShieldedReservation = {
  expiryHeight?: number;
  // 'unsigned': PCZT built for a review page that may still be abandoned;
  // released by the next build or by expiry. 'signed': carried to broadcast.
  // Missing on rows written before the state existed; treated as signed.
  state?: 'unsigned' | 'signed';
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
  preferTransparentForShieldedSends?: boolean;
  birthdayHeight?: number;
  birthdaySource?: IZcashBirthdaySource;
  birthdayTimestamp?: number;
  birthdayMonthHint?: IZcashBirthdayMonthHint;
  resumeFromHeight?: number;
  operation?: IZcashPrivacyModeOperation;
  updatedAt: number;
};

export type IZcashPrivacyModeStateView = Partial<IZcashPrivacyModeState> & {
  intent: IZcashPrivacyModeIntent;
};

// Viewing-level Zcash account metadata (exposure equivalent to storing an
// xpub). Keyed by db account id. Local-only, never cloud-synced; the spending
// key is re-derived inside the wasm from the mnemonic at sign time.
export interface IZcashAccountMeta {
  ufvk: string;
  unifiedAddress: string;
  transparentAddress: string;
  seedFingerprintHex: string;
  hdIndex: number;
  // Fixed when privacy mode is enabled so re-scans stay stable.
  birthdayHeight?: number;
  birthdaySource?: IZcashBirthdaySource;
  // Approximate user-provided recovery month. This is diagnostic input, not
  // a second scan cursor; birthdayHeight remains the only scanner authority.
  birthdayTimestamp?: number;
  // OUR address-derivation ledger (ZCASH_ADDRESS_SCHEME_VERSION at write
  // time). Addresses are a cache of (UFVK × scheme version): when this lags
  // the current version, the zcash vault lazily re-derives from the UFVK (no
  // password) and overwrites. Absent on pre-versioning records.
  addressSchemeVersion?: number;
  createdAt: number;
}

export interface IZcashDB {
  accounts: Record<string, IZcashAccountMeta>;
  // Product intent is App-owned. Missing records deliberately mean off; old
  // development data is not migrated into an enabled state.
  privacyModeAccounts?: Record<string, IZcashPrivacyModeState>;
  // Per-wallet (not per-account): true only for a freshly generated
  // mnemonic (EAppEventBusNames.WalletAdded). Absent = not proven fresh,
  // the safe default for KeyringHd's birthday decision.
  walletFreshMnemonic?: Record<string, boolean>;
  // Recorded at mnemonic-wallet creation time, never when a later Zcash
  // account is added. Used only to recommend a recovery month on opt-in.
  walletCreatedAtTimestamps?: Record<string, number>;
  // Durable repair journal. A process death between purging the wasm cache
  // and saving the new birthday is resumed before the next scan starts.
  pendingRescans?: Record<string, IZcashPendingRescan>;
  transparentReservations?: Record<
    string,
    Record<string, IZcashTransparentReservation>
  >;
  transparentPendingTxs?: Record<
    string,
    Record<string, IZcashTransparentPendingTx>
  >;
  // Host lifecycle journal only; private transaction/history truth remains in
  // the runtime database. This closes the UI gap between PCZT creation and
  // runtime finalization, when the runtime has no txid to expose yet.
  shieldedReservations?: Record<
    string,
    Record<string, IZcashShieldedReservation>
  >;
}

export class SimpleDbEntityZcash extends SimpleDbEntityBase<IZcashDB> {
  entityName = 'zcash';

  override enableCache = false;

  async saveAccountMeta({
    accountId,
    meta,
  }: {
    accountId: string;
    meta: IZcashAccountMeta;
  }) {
    // setRawData replaces the whole record with whatever the builder
    // returns (no implicit merge) -- every method here must spread
    // ...rawData first or it silently wipes the OTHER top-level key.
    await this.setRawData((rawData) => {
      const privacyModeState = rawData?.privacyModeAccounts?.[accountId];
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
  }: {
    accountId: string;
    birthdayHeight?: number;
    birthdayTimestamp?: number;
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
  }: {
    accountId: string;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const current = rawData?.privacyModeAccounts?.[accountId];
      if (current?.operation?.type !== 'enable') {
        throw new OneKeyLocalError(
          'zcash: privacy enable operation is not pending',
        );
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

  async listPendingPrivacyModeDisables(): Promise<string[]> {
    const rawData = await this.getRawData();
    return Object.entries(rawData?.privacyModeAccounts ?? {}).flatMap(
      ([accountId, state]) =>
        state.operation?.type === 'disable' ? [accountId] : [],
    );
  }

  async cancelPendingPrivacyModeEnables(): Promise<string[]> {
    const cancelledAccountIds: string[] = [];
    await this.setRawData((rawData) => {
      const privacyModeAccounts = { ...rawData?.privacyModeAccounts };
      for (const [accountId, state] of Object.entries(privacyModeAccounts)) {
        if (state.operation?.type === 'enable') {
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

  async setPreferTransparentForShieldedSends({
    accountId,
    enabled,
  }: {
    accountId: string;
    enabled: boolean;
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
            intent: current?.intent ?? 'off',
            preferTransparentForShieldedSends: enabled,
            updatedAt: Date.now(),
          },
        },
      };
    });
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
        ...Object.keys(rawData?.transparentReservations ?? {}),
        ...Object.keys(rawData?.transparentPendingTxs ?? {}),
        ...Object.keys(rawData?.shieldedReservations ?? {}),
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
      return { ...rawData, accounts, pendingRescans };
    });
  }

  async removeAccountState({ accountId }: { accountId: string }) {
    await this.setRawData((rawData) => {
      const accounts = { ...rawData?.accounts };
      const pendingRescans = { ...rawData?.pendingRescans };
      const privacyModeAccounts = { ...rawData?.privacyModeAccounts };
      const transparentReservations = {
        ...rawData?.transparentReservations,
      };
      const transparentPendingTxs = { ...rawData?.transparentPendingTxs };
      const shieldedReservations = { ...rawData?.shieldedReservations };
      delete accounts[accountId];
      delete pendingRescans[accountId];
      delete privacyModeAccounts[accountId];
      delete transparentReservations[accountId];
      delete transparentPendingTxs[accountId];
      delete shieldedReservations[accountId];
      return {
        ...rawData,
        accounts,
        pendingRescans,
        privacyModeAccounts,
        transparentReservations,
        transparentPendingTxs,
        shieldedReservations,
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

  async removeWalletBirthdayState({ walletId }: { walletId: string }) {
    await this.setRawData((rawData) => {
      const walletFreshMnemonic = { ...rawData?.walletFreshMnemonic };
      const walletCreatedAtTimestamps = {
        ...rawData?.walletCreatedAtTimestamps,
      };
      delete walletFreshMnemonic[walletId];
      delete walletCreatedAtTimestamps[walletId];
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        walletFreshMnemonic,
        walletCreatedAtTimestamps,
      };
    });
  }

  async listWalletBirthdayStateIds(): Promise<string[]> {
    const rawData = await this.getRawData();
    return Array.from(
      new Set([
        ...Object.keys(rawData?.walletFreshMnemonic ?? {}),
        ...Object.keys(rawData?.walletCreatedAtTimestamps ?? {}),
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

  async removePendingRescan({ accountId }: { accountId: string }) {
    await this.setRawData((rawData) => {
      const pendingRescans = { ...rawData?.pendingRescans };
      delete pendingRescans[accountId];
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        pendingRescans,
      };
    });
  }

  async reserveTransparentOutpoints({
    accountId,
    ownerId,
    outpoints,
    currentHeight,
    expiryHeight,
  }: {
    accountId: string;
    ownerId: string;
    outpoints: IZcashTransparentOutpoint[];
    currentHeight: number;
    expiryHeight: number;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const transparentReservations = Object.fromEntries(
        Object.entries(rawData?.transparentReservations ?? {}).map(
          ([storedAccountId, reservations]) => [
            storedAccountId,
            { ...reservations },
          ],
        ),
      );
      for (const reservations of Object.values(transparentReservations)) {
        for (const [key, reservation] of Object.entries(reservations)) {
          if (reservation.expiryHeight < currentHeight) {
            delete reservations[key];
          }
        }
      }
      const reservations = transparentReservations[accountId] ?? {};
      for (const outpoint of outpoints) {
        const key = `${outpoint.txid}:${outpoint.vout}`;
        const existing = Object.values(transparentReservations)
          .map((storedReservations) => storedReservations[key])
          .find(Boolean);
        if (existing && existing.ownerId !== ownerId) {
          const error = new OneKeyLocalError(
            'zcash: a selected transparent input is already reserved',
          );
          Object.assign(error, {
            code: 'UTXO_ALREADY_RESERVED',
            params: { outpoint: key },
          });
          throw error;
        }
        reservations[key] = { ownerId, createdAt: Date.now(), expiryHeight };
      }
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        transparentReservations: {
          ...transparentReservations,
          [accountId]: reservations,
        },
      };
    });
  }

  async releaseTransparentReservation({
    accountId,
    ownerId,
  }: {
    accountId: string;
    ownerId: string;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const reservations = {
        ...rawData?.transparentReservations?.[accountId],
      };
      for (const [key, reservation] of Object.entries(reservations)) {
        if (reservation.ownerId === ownerId) {
          delete reservations[key];
        }
      }
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        transparentReservations: {
          ...rawData?.transparentReservations,
          [accountId]: reservations,
        },
      };
    });
  }

  async saveTransparentPendingTx({
    accountId,
    tx,
  }: {
    accountId: string;
    tx: IZcashTransparentPendingTx;
  }): Promise<void> {
    await this.setRawData((rawData) => ({
      ...rawData,
      accounts: rawData?.accounts ?? {},
      transparentPendingTxs: {
        ...rawData?.transparentPendingTxs,
        [accountId]: {
          ...rawData?.transparentPendingTxs?.[accountId],
          [tx.txid]: tx,
        },
      },
    }));
  }

  async listTransparentPendingTxs({
    accountId,
  }: {
    accountId: string;
  }): Promise<IZcashTransparentPendingTx[]> {
    const rawData = await this.getRawData();
    return Object.values(rawData?.transparentPendingTxs?.[accountId] ?? {});
  }

  async markTransparentPendingTxAccepted({
    accountId,
    txid,
  }: {
    accountId: string;
    txid: string;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const pending = {
        ...rawData?.transparentPendingTxs?.[accountId],
      };
      const tx = pending[txid];
      if (tx) {
        pending[txid] = { ...tx, broadcastState: 'accepted' };
      }
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        transparentPendingTxs: {
          ...rawData?.transparentPendingTxs,
          [accountId]: pending,
        },
      };
    });
  }

  async pruneExpiredTransparentState({
    accountId,
    currentHeight,
  }: {
    accountId: string;
    currentHeight?: number;
  }): Promise<string[]> {
    const expiredTxids: string[] = [];
    await this.setRawData((rawData) => {
      const pending = {
        ...rawData?.transparentPendingTxs?.[accountId],
      };
      const reservations = {
        ...rawData?.transparentReservations?.[accountId],
      };
      const expiredOwners = new Set<string>();
      for (const [txid, tx] of Object.entries(pending)) {
        if (currentHeight !== undefined && tx.expiryHeight < currentHeight) {
          expiredTxids.push(txid);
          expiredOwners.add(tx.ownerId);
          delete pending[txid];
        }
      }
      for (const [key, reservation] of Object.entries(reservations)) {
        if (
          (currentHeight !== undefined &&
            reservation.expiryHeight < currentHeight) ||
          expiredOwners.has(reservation.ownerId)
        ) {
          delete reservations[key];
        }
      }
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        transparentPendingTxs: {
          ...rawData?.transparentPendingTxs,
          [accountId]: pending,
        },
        transparentReservations: {
          ...rawData?.transparentReservations,
          [accountId]: reservations,
        },
      };
    });
    return expiredTxids;
  }

  async settleTransparentPendingTx({
    accountId,
    txid,
  }: {
    accountId: string;
    txid: string;
  }): Promise<void> {
    await this.setRawData((current) => {
      const pending = {
        ...current?.transparentPendingTxs?.[accountId],
      };
      const reservations = {
        ...current?.transparentReservations?.[accountId],
      };
      const ownerId = pending[txid]?.ownerId;
      delete pending[txid];
      if (ownerId) {
        for (const [key, reservation] of Object.entries(reservations)) {
          if (reservation.ownerId === ownerId) {
            delete reservations[key];
          }
        }
      }
      return {
        ...current,
        accounts: current?.accounts ?? {},
        transparentPendingTxs: {
          ...current?.transparentPendingTxs,
          [accountId]: pending,
        },
        transparentReservations: {
          ...current?.transparentReservations,
          [accountId]: reservations,
        },
      };
    });
  }

  async saveShieldedReservation({
    accountId,
    reservationId,
    expiryHeight,
    state,
  }: {
    accountId: string;
    reservationId: string;
    expiryHeight: number;
    state: IZcashShieldedReservation['state'];
  }): Promise<void> {
    await this.setRawData((rawData) => ({
      ...rawData,
      accounts: rawData?.accounts ?? {},
      shieldedReservations: {
        ...rawData?.shieldedReservations,
        [accountId]: {
          ...rawData?.shieldedReservations?.[accountId],
          [reservationId]: { expiryHeight, state },
        },
      },
    }));
  }

  async markShieldedReservationSigned({
    accountId,
    reservationId,
  }: {
    accountId: string;
    reservationId: string;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const existing =
        rawData?.shieldedReservations?.[accountId]?.[reservationId];
      if (!existing) {
        return rawData ?? { accounts: {} };
      }
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        shieldedReservations: {
          ...rawData?.shieldedReservations,
          [accountId]: {
            ...rawData?.shieldedReservations?.[accountId],
            [reservationId]: { ...existing, state: 'signed' },
          },
        },
      };
    });
  }

  async removeShieldedReservation({
    accountId,
    reservationId,
  }: {
    accountId: string;
    reservationId: string;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const reservations = {
        ...rawData?.shieldedReservations?.[accountId],
      };
      delete reservations[reservationId];
      return {
        ...rawData,
        accounts: rawData?.accounts ?? {},
        shieldedReservations: {
          ...rawData?.shieldedReservations,
          [accountId]: reservations,
        },
      };
    });
  }

  async listShieldedReservations({
    accountId,
  }: {
    accountId: string;
  }): Promise<Array<IZcashShieldedReservation & { reservationId: string }>> {
    const rawData = await this.getRawData();
    return Object.entries(rawData?.shieldedReservations?.[accountId] ?? {}).map(
      ([reservationId, reservation]) => ({
        reservationId,
        ...reservation,
      }),
    );
  }
}
