// Bits of the SKAdNetwork fine conversion value (0-63). The schema configured
// for the ad network (TikTok Events Manager) must map the same bits, so never
// renumber an existing milestone.
export enum ESkanMilestone {
  AppOpened = 1,
  WalletActivated = 2,
  BackupCompleted = 4,
  HasAssets = 8,
  FirstTransaction = 16,
  HardwareWalletConnected = 32,
}

// Coarse values are all SKAdNetwork 4 reports in the second and third
// conversion windows.
export const SKAN_COARSE_RULE = {
  highMask: ESkanMilestone.HasAssets | ESkanMilestone.FirstTransaction,
  mediumMask: ESkanMilestone.WalletActivated | ESkanMilestone.BackupCompleted,
} as const;

export interface ISkanConversion {
  markSkanMilestones: (...milestones: ESkanMilestone[]) => Promise<void>;
  /**
   * Reports an app open. SKAdNetwork 4 needs an update during every
   * conversion window, so call this on launch and when the app returns to
   * the foreground; repeated calls inside the throttle window are dropped.
   */
  markSkanAppOpened: () => Promise<void>;
}
