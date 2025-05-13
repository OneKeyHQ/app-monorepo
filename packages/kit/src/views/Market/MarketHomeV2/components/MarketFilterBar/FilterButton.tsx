import { Button } from '@onekeyhq/components';

interface IFilterButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}

export default function FilterButton({
  onPress,
  disabled,
  testID = 'market-table-filter-button',
}: IFilterButtonProps) {
  return (
    <Button
      size="small"
      variant="secondary"
      icon="Filter1Outline"
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      borderRadius="$3"
    >
      Filter
    </Button>
  );
}
