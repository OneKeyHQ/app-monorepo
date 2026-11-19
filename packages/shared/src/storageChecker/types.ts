export enum EStorageFullReason {
  /**
   * `navigator.storage.estimate()` reported less write headroom than the
   * warning threshold. For a browser extension the quota — not the physical
   * disk — is the binding write limit, so this is a genuine "cannot write"
   * condition even when the machine still shows plenty of free space.
   */
  QuotaExhausted = 'quotaExhausted',
  /**
   * A storage write actually failed with a disk-full / quota-exceeded signal
   * from IndexedDB.
   */
  WriteFailed = 'writeFailed',
}

export interface IStorageQuotaInfo {
  /** Bytes the browser is willing to grant this storage key. */
  quotaBytes: number;
  /** Bytes currently used by this storage key. */
  usageBytes: number;
  /** `quotaBytes - usageBytes`: the headroom left for new writes. */
  availableBytes: number;
}

export interface IStorageFullDiagnostics {
  reason: EStorageFullReason;
  /**
   * Last successful measurement. Absent only when the flag was raised by a
   * failed write before any measurement ever succeeded.
   */
  quotaInfo?: IStorageQuotaInfo;
  /** Original error message, present when `reason` is `WriteFailed`. */
  errorMessage?: string;
}
