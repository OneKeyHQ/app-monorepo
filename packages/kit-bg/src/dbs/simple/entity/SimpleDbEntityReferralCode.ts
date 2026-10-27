import type { EInviteCodeAttributionSource } from '@onekeyhq/shared/src/referralCode/installReferrerUtils';
import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IWalletReferralCode {
  walletId: string;
  address: string;
  networkId: string;
  pubkey: string;
  isBound: boolean;
  createdAt?: number;
  bindable?: boolean;
  bindWindowReason?: string;
}

/**
 * Invite code recovered from a store install referrer.
 *
 * Deliberately NOT stored in `cachedInviteCode`: that field is the Settings
 * dialog's draft-recovery cache, which the onboarding dialog intentionally
 * ignores so a stale draft from another wallet can never be pre-applied. An
 * install-referrer code is a different thing — a first-party attribution
 * signal tied to this specific install — so it gets its own slot and its own
 * lifecycle.
 */
export interface IInstallReferralRecord {
  code: string;
  source: EInviteCodeAttributionSource;
  /** ms epoch the TTL is measured from (app install time). */
  attributedAt: number;
  /** ms epoch this record was created, i.e. when the referrer was read. */
  createdAt: number;
  /**
   * TTL policy in force when the record was written.
   *
   * Expiry is evaluated against the *current* constant, so shortening the
   * policy in a later release retires existing records immediately. This
   * field is provenance: together with `createdAt` it lets a future release
   * target records created under a specific older policy, instead of having
   * to guess which rule a stored code was captured under.
   */
  ttlDays: number;
  /** Set once the code has been successfully bound to a wallet. */
  consumedAt?: number;
}

export interface IReferralCodeData {
  myReferralCode: string;
  postConfig?: IInvitePostConfig;
  walletReferralCode?: Record<string, IWalletReferralCode>;
  walletCreationRecordTimestamps?: Record<string, string>;
  cachedInviteCode?: string;
  creationRecordsMigrationDone?: boolean;
  installReferral?: IInstallReferralRecord;
  /** Successful binds made before the native attribution read completes. */
  pendingBoundReferralCodes?: Record<string, number>;
  /**
   * Set once the native capture reached a terminal state and we processed it,
   * so later launches skip the native round-trip. Cleared by `reset()`, which
   * lets a wiped profile re-read the still-intact native payload.
   *
   * This flag is what confines the capture to the first launch after a fresh
   * install (see the FIRST-LAUNCH CONTRACT in `installInviteCodeCapture.ts`);
   * anything else that clears it re-opens the capture on the next launch.
   */
  installReferralCaptureResolved?: boolean;
  /**
   * Set when a launch judged this installation fresh but left the capture
   * pending (an empty Play referrer inside Play's serving window). A later app
   * update separates Play's install and update timestamps, so without this the
   * retry would mistake the same fresh install for an upgraded one and give up
   * on a real referral. Cleared once the capture resolves.
   */
  installReferralPendingFreshInstall?: boolean;
}

export class SimpleDbEntityReferralCode extends SimpleDbEntityBase<IReferralCodeData> {
  entityName = 'ReferralCode';

  override enableCache = false;

  async updateCode(params: Partial<IReferralCodeData>) {
    return this.setRawData(
      (rawData) =>
        ({
          ...rawData,
          ...params,
        }) as IReferralCodeData,
    );
  }

  async updatePostConfig(params: IInvitePostConfig) {
    return this.setRawData(
      (rawData) =>
        ({
          ...rawData,
          postConfig: params,
        }) as IReferralCodeData,
    );
  }

  async getPostConfig(): Promise<IInvitePostConfig | undefined> {
    const rawData = await this.getRawData();
    return rawData?.postConfig;
  }

  async getMyReferralCode(): Promise<string> {
    const rawData = await this.getRawData();
    return rawData?.myReferralCode ?? '';
  }

  async getWalletReferralCode({
    walletId,
  }: {
    walletId: string;
  }): Promise<IWalletReferralCode | undefined> {
    const rawData = await this.getRawData();
    return rawData?.walletReferralCode?.[walletId];
  }

  async setWalletReferralCode({
    walletId,
    referralCodeInfo,
  }: {
    walletId: string;
    referralCodeInfo: IWalletReferralCode;
  }) {
    return this.setRawData(
      (rawData) =>
        ({
          ...rawData,
          walletReferralCode: {
            ...rawData?.walletReferralCode,
            [walletId]: {
              walletId: referralCodeInfo.walletId,
              address: referralCodeInfo.address,
              networkId: referralCodeInfo.networkId,
              pubkey: referralCodeInfo.pubkey,
              isBound: referralCodeInfo.isBound,
              createdAt: Date.now(),
              bindable: referralCodeInfo.bindable,
              bindWindowReason: referralCodeInfo.bindWindowReason,
            },
          },
        }) as IReferralCodeData,
    );
  }

  async getWalletCreationRecordTimestamp({
    walletId,
  }: {
    walletId: string;
  }): Promise<string | undefined> {
    const rawData = await this.getRawData();
    return rawData?.walletCreationRecordTimestamps?.[walletId];
  }

  async setWalletCreationRecordTimestamp({
    walletId,
    walletCreatedAt,
  }: {
    walletId: string;
    walletCreatedAt: string;
  }) {
    return this.setRawData(
      (rawData) =>
        ({
          ...rawData,
          walletCreationRecordTimestamps: {
            ...rawData?.walletCreationRecordTimestamps,
            [walletId]: walletCreatedAt,
          },
        }) as IReferralCodeData,
    );
  }

  async isCreationRecordsMigrationDone(): Promise<boolean> {
    const rawData = await this.getRawData();
    return rawData?.creationRecordsMigrationDone ?? false;
  }

  async setCreationRecordsMigrationDone() {
    return this.setRawData(
      (rawData) =>
        ({
          ...rawData,
          creationRecordsMigrationDone: true,
        }) as IReferralCodeData,
    );
  }

  async resetPostConfig() {
    return this.setRawData(
      (rawData) =>
        ({
          ...rawData,
          postConfig: undefined,
        }) as IReferralCodeData,
    );
  }

  async reset() {
    return this.setRawData({
      myReferralCode: '',
      postConfig: undefined,
      walletReferralCode: {},
      walletCreationRecordTimestamps: {},
    });
  }

  async getCachedInviteCode(): Promise<string> {
    const rawData = await this.getRawData();
    return rawData?.cachedInviteCode ?? '';
  }

  async setCachedInviteCode(code: string) {
    return this.setRawData(
      (rawData) =>
        ({
          ...rawData,
          cachedInviteCode: code,
        }) as IReferralCodeData,
    );
  }

  async getInstallReferral(): Promise<IInstallReferralRecord | undefined> {
    const rawData = await this.getRawData();
    return rawData?.installReferral;
  }

  async setInstallReferral(record: IInstallReferralRecord) {
    return this.setRawData((rawData) => {
      const consumedAt =
        rawData?.pendingBoundReferralCodes?.[record.code.toLowerCase()] ??
        (rawData?.installReferral?.code.toLowerCase() ===
        record.code.toLowerCase()
          ? rawData.installReferral.consumedAt
          : undefined);
      return {
        ...rawData,
        installReferral: consumedAt ? { ...record, consumedAt } : record,
        installReferralCaptureResolved: true,
        installReferralPendingFreshInstall: undefined,
        pendingBoundReferralCodes: undefined,
      } as IReferralCodeData;
    });
  }

  /**
   * The record and the resolved flag from a single read. They must come from
   * one snapshot: `setInstallReferral` writes both together, so reading them
   * separately can straddle that write and report "resolved" with no code,
   * which makes a waiting dialog give up on a code that just landed.
   */
  async getInstallReferralState(): Promise<{
    record: IInstallReferralRecord | undefined;
    isCaptureResolved: boolean;
  }> {
    const rawData = await this.getRawData();
    return {
      record: rawData?.installReferral,
      isCaptureResolved: rawData?.installReferralCaptureResolved ?? false,
    };
  }

  async isInstallReferralCaptureResolved(): Promise<boolean> {
    const rawData = await this.getRawData();
    return rawData?.installReferralCaptureResolved ?? false;
  }

  async getInstallReferralCaptureState(): Promise<{
    isResolved: boolean;
    isPendingFreshInstall: boolean;
  }> {
    const rawData = await this.getRawData();
    return {
      isResolved: rawData?.installReferralCaptureResolved ?? false,
      isPendingFreshInstall:
        rawData?.installReferralPendingFreshInstall ?? false,
    };
  }

  async markInstallReferralPendingFreshInstall() {
    return this.setRawData(
      (rawData) =>
        ({
          ...rawData,
          installReferralPendingFreshInstall: true,
        }) as IReferralCodeData,
    );
  }

  /**
   * Records that the native capture finished without yielding a usable code
   * (organic install, ad-tagged referrer, or no Play Store). Stops later
   * launches from paying for the native read again.
   */
  async markInstallReferralCaptureResolved() {
    return this.setRawData(
      (rawData) =>
        ({
          ...rawData,
          installReferralCaptureResolved: true,
          installReferralPendingFreshInstall: undefined,
          pendingBoundReferralCodes: undefined,
        }) as IReferralCodeData,
    );
  }

  /**
   * Marks the stored code consumed when it matches a successful bind. If
   * capture has not finished, remember the bound code so a later native read
   * cannot offer it again. The decision runs inside the write's mutex.
   */
  async markInstallReferralConsumedIfMatches({
    code,
    now,
  }: {
    code: string;
    now: number;
  }): Promise<boolean> {
    let isConsumed = false;
    await this.setRawData((rawData) => {
      const record = rawData?.installReferral;
      if (!record) {
        return rawData?.installReferralCaptureResolved
          ? (rawData as IReferralCodeData)
          : ({
              ...rawData,
              pendingBoundReferralCodes: {
                ...rawData?.pendingBoundReferralCodes,
                [code.toLowerCase()]: now,
              },
            } as IReferralCodeData);
      }
      if (
        record.consumedAt ||
        record.code.toLowerCase() !== code.toLowerCase()
      ) {
        return rawData as IReferralCodeData;
      }
      isConsumed = true;
      return {
        ...rawData,
        installReferral: { ...record, consumedAt: now },
      } as IReferralCodeData;
    });
    return isConsumed;
  }
}
