/**
 * Rookie Guide Types
 *
 * Type definitions for the rookie onboarding guide feature.
 * This feature helps new users complete key tasks like deposit, swap, and DApp interaction.
 */

/** Rookie task type enum */
export enum ERookieTaskType {
  /** Deposit task: detect balance change from 0 to > 0 */
  DEPOSIT = 'deposit',
  /** Swap task: visit Swap tab or complete a swap transaction */
  SWAP = 'swap',
  /** DApp task: visit DApp page or connect wallet */
  DAPP = 'dapp',
}

/**
 * Task progress storage structure - hash table with timestamps
 * Key exists means task is completed, value is completion timestamp
 */
export interface IRookieGuideProgress {
  [ERookieTaskType.DEPOSIT]?: number;
  [ERookieTaskType.SWAP]?: number;
  [ERookieTaskType.DAPP]?: number;
}

/** OneKey ID information for rookie guide */
export interface IRookieGuideOneKeyIdInfo {
  isLoggedIn: boolean;
  email?: string;
  userId?: string;
}

/** Complete rookie guide info returned by Provider API */
export interface IRookieGuideInfo {
  /** Current active account fiat balance */
  fiatBalance: string;
  /** Currency unit (e.g., "usd") */
  currency: string;
  /** OneKey ID information */
  oneKeyId: IRookieGuideOneKeyIdInfo;
  /** Application instance ID */
  instanceId: string;
  /** Task completion progress */
  taskProgress: IRookieGuideProgress;
}
