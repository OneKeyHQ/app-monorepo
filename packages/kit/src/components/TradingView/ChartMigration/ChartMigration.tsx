// Web / non-native, non-desktop fallback.
//
// The TradingView cross-origin chart-data migration (Part D) runs only on iOS
// and Desktop (Android reuses the old origin via Part G; web has no offline
// chart). The platform-specific hosts live in ChartMigration.native.tsx /
// ChartMigration.desktop.tsx; this stub keeps the import resolvable elsewhere.
export function ChartMigration() {
  return null;
}

export default ChartMigration;
