import { Button } from '@onekeyhq/components';

// The quiet "label ›" link beside a card or section label (Payout history,
// Manage codes, Referral list).
export function CardTextAction({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Button
      testID={testID}
      variant="tertiary"
      size="small"
      iconAfter="ChevronRightSmallOutline"
      onPress={onPress}
    >
      {label}
    </Button>
  );
}
