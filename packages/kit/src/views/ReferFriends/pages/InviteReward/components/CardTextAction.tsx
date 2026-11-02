import { Button, NATIVE_HIT_SLOP } from '@onekeyhq/components';

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
      // The link is 28px tall; the slop brings its touch area to 44px.
      hitSlop={NATIVE_HIT_SLOP}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}
