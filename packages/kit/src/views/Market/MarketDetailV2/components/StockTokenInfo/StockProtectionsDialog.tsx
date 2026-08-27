import { Dialog, SizableText, XStack, YStack } from '@onekeyhq/components';

import { STAT_FALLBACK_VALUE } from '../../utils/statValue';

// TODO(data): the token variant API does not expose a protections payload yet.
// The rows below are only the structural catalogue of protection categories
// from the design (Figma 25348:103122); the layout is in place, but every value
// renders as the standard fallback until the backend ships the per-issuer
// payload. These guarantees differ by issuer, so they must never be asserted
// from static data.
const PROTECTIONS_TITLE = 'Tokenholder Protections';

// `kind` records how a row is meant to render once the payload lands: `flag`
// rows resolve to a yes/no state, `report` rows to an attestation link.
type IProtectionRow = {
  key: string;
  label: string;
  kind: 'flag' | 'report';
};

const PROTECTION_ROWS: IProtectionRow[] = [
  {
    key: 'realAssetBacking',
    kind: 'flag',
    label: 'Real Asset Backing',
  },
  {
    key: 'dividendReinvestment',
    kind: 'flag',
    label: 'Dividend Reinvestment',
  },
  {
    key: 'collateral',
    kind: 'flag',
    label: 'Security Interest in Collateral',
  },
  {
    key: 'bankruptcyRemote',
    kind: 'flag',
    label: 'Bankruptcy remote',
  },
  {
    key: 'dailyAttestation',
    kind: 'report',
    label: 'Daily attestation reports',
  },
  {
    key: 'monthlyAttestation',
    kind: 'report',
    label: 'Monthly attestation reports',
  },
];

function ProtectionRow({ row }: { row: IProtectionRow }) {
  return (
    <XStack minHeight={20} alignItems="center" gap="$2">
      <XStack flex={1} minWidth={0} gap="$1" alignItems="center">
        <SizableText size="$bodyMdMedium" color="$textSubdued">
          {row.label}
        </SizableText>
      </XStack>
      <SizableText
        testID={`stock-protection-value-${row.key}`}
        size="$bodyMdMedium"
        color="$textSubdued"
        textAlign="right"
        flexShrink={0}
      >
        {STAT_FALLBACK_VALUE}
      </SizableText>
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
