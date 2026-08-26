import {
  DashText,
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

// TODO(data): the protections payload is not exposed by the token variant API
// yet, so the dialog ships with the design's demo rows (Figma 25348:103122).
// Replace PROTECTION_ROWS with the backend payload once it lands.
const PROTECTIONS_TITLE = 'Tokenholder Protections';

type IProtectionRow = {
  key: string;
  label: string;
  tooltip?: string;
} & (
  | { kind: 'flag'; enabled: boolean }
  | { kind: 'report'; reportLabel: string; onPress?: () => void }
);

const PROTECTION_ROWS: IProtectionRow[] = [
  {
    key: 'realAssetBacking',
    kind: 'flag',
    label: 'Real Asset Backing',
    tooltip:
      'Each token is backed 1:1 by the underlying share held in custody.',
    enabled: true,
  },
  {
    key: 'dividendReinvestment',
    kind: 'flag',
    label: 'Dividend Reinvestment',
    tooltip: 'Dividends are reinvested into the underlying position.',
    enabled: true,
  },
  {
    key: 'collateral',
    kind: 'flag',
    label: 'Security Interest in Collateral',
    tooltip: 'Tokenholders hold a security interest in the collateral.',
    enabled: true,
  },
  {
    key: 'bankruptcyRemote',
    kind: 'flag',
    label: 'Bankruptcy remote',
    tooltip: 'Collateral sits in a bankruptcy-remote vehicle.',
    enabled: true,
  },
  {
    key: 'dailyAttestation',
    kind: 'report',
    label: 'Daily attestation reports',
    reportLabel: 'View Report',
  },
  {
    key: 'monthlyAttestation',
    kind: 'report',
    label: 'Monthly attestation reports',
    reportLabel: 'View Report',
  },
];

function ProtectionRow({ row }: { row: IProtectionRow }) {
  return (
    <XStack minHeight={20} alignItems="center" gap="$2">
      <XStack flex={1} minWidth={0} gap="$1" alignItems="center">
        {row.tooltip ? (
          <DashText
            size="$bodyMdMedium"
            color="$textSubdued"
            dashThickness={0.5}
            tooltip={row.tooltip}
            tooltipTitle={row.label}
          >
            {row.label}
          </DashText>
        ) : (
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {row.label}
          </SizableText>
        )}
      </XStack>
      {row.kind === 'flag' ? (
        <XStack gap="$1.5" alignItems="center">
          <SizableText
            size="$bodyMd"
            color={row.enabled ? '$textSuccess' : '$textSubdued'}
          >
            {row.enabled ? 'Yes' : 'No'}
          </SizableText>
          <Icon
            name={row.enabled ? 'CheckRadioSolid' : 'XCircleSolid'}
            size="$5"
            color={row.enabled ? '$iconSuccess' : '$iconSubdued'}
          />
        </XStack>
      ) : (
        <XStack
          gap="$1.5"
          alignItems="center"
          cursor={row.onPress ? 'pointer' : undefined}
          hoverStyle={row.onPress ? { opacity: 0.8 } : undefined}
          onPress={row.onPress}
        >
          <SizableText size="$bodyMd" color="$text">
            {row.reportLabel}
          </SizableText>
          <Icon name="OpenOutline" size="$5" color="$iconSubdued" />
        </XStack>
      )}
    </XStack>
  );
}

export const STOCK_PROTECTION_COUNT = PROTECTION_ROWS.length;

export function showStockProtectionsDialog() {
  Dialog.show({
    title: PROTECTIONS_TITLE,
    showFooter: false,
    renderContent: (
      <YStack gap="$4">
        {PROTECTION_ROWS.map((row) => (
          <ProtectionRow key={row.key} row={row} />
        ))}
      </YStack>
    ),
  });
}
