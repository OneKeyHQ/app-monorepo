// Hardcoded English until copy review; then move to Lokalise keys.
export const LEVEL_COPY = {
  levelKept: 'Level kept this month',
  levelNotKept: 'Level not kept yet this month',
  levelRules: 'Level rules',
  targetReached: 'Target reached',
  allLevels: 'All levels',
  commissionRatesTitle: 'Commission rates',
  levelDetails: 'Level details',
  upgradeTo: (level: string) => `Upgrade to ${level}`,
  nextLevel: (level: string) => `Next level: ${level}`,
  // Above the compact level table: the figures are monthly, and one met
  // target is enough to keep or reach a level.
  tableRule: (hasChoice: boolean) =>
    hasChoice ? 'Monthly amounts · meet any one' : 'Monthly amounts',
  keepColumn: 'Keep',
  reachColumn: 'Reach',
  rateColumn: 'You / Invitee',
  upgradeRule: (hasChoice: boolean) =>
    hasChoice ? 'Meet any one this month' : 'Meet this target this month',
  topLevel: "You're at the top level",
  yourRatesAt: (level: string) => `Your rates at ${level}`,
  toGo: (amount: string) => `${amount} to go`,
} as const;

// Level-up targets are monthly; headings say "this month", so rows use short
// names instead of the backend's "Monthly ..." labels.
export const LEVEL_TARGET_SHORT_LABELS: Record<string, string> = {
  HardwareSales: 'Hardware sales',
  Perp: 'Perps volume',
  Swap: 'Swap volume',
};

// Product names in the compact level table's row headers, where each column
// is a few characters wide.
export const LEVEL_SUBJECT_SHORT_LABELS: Record<string, string> = {
  HardwareSales: 'Hardware',
  Perp: 'Perps',
  Swap: 'Swap',
  Earn: 'DeFi',
  Onchain: 'DeFi',
};
