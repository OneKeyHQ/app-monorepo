import { Icon } from '../Icon';
import { Input } from '../Input';
import { XStack } from '../Stack';

export function SearchBar() {
  return (
    <XStack
      borderColor="$border"
      borderWidth="$px"
      borderRadius="$2"
      alignItems="center"
      paddingHorizontal="$1.5"
    >
      <Icon name="SearchOutline" size="$6" />
      <Input h="$7" borderWidth={0} flex={1} />
      <Icon name="XCircleOutline" size="$6" />
    </XStack>
  );
}
