// Hardcoded English until copy review; then move to Lokalise keys.
export const LEVEL_COPY = {
  levelKept: 'Level kept this month',
  levelNotKept: 'Level not kept yet this month',
  levelRules: 'Level rules',
  targetReached: 'Target reached',
  allLevels: 'All levels',
  upgradeTo: (level: string) => `Upgrade to ${level}`,
  target: (amount: string) => `Target ${amount}`,
  toGo: (amount: string) => `${amount} to go`,
  commissionRates: (level: string) => `${level} commission rates`,
} as const;
