// Hardcoded English until copy review; then move to Lokalise keys.
export const LEVEL_COPY = {
  levelKept: 'Kept this month',
  levelNotKept: 'Not kept yet this month',
  levelRules: 'Level rules',
  targetReached: 'Reached',
  allLevels: 'All levels',
  rates: 'Rates',
  levelDetails: 'Level details',
  upgradeTo: 'Upgrade to {level}',
  nextLevel: 'Next level: {level}',
  levelRates: '{level} rates',
  // Above the compact level table: the figures are monthly, and one met
  // target is enough to keep or reach a level.
  tableRule: 'Monthly · meet any one',
  tableRuleSingle: 'Monthly',
  keepColumn: 'Keep',
  reachColumn: 'Reach',
  rateColumn: 'You / Invitee',
  upgradeRule: 'Meet any one this month',
  upgradeRuleSingle: 'Meet this target this month',
  topLevel: 'Top level reached',
  toGo: '{amount} to go',
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
