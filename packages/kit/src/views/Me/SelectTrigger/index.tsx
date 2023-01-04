import { Box, Icon, Text, Typography } from '@onekeyhq/components';
import type { ICON_NAMES } from '@onekeyhq/components/src/Icon';
import type { SelectItem } from '@onekeyhq/components/src/Select';

type FieldProps<T> = {
  title: string;
  activeOption: SelectItem<T>;
  hideDivider?: boolean;
  iconName?: ICON_NAMES;
};

export function SelectTrigger<T>({
  title,
  activeOption,
  hideDivider,
  iconName,
}: FieldProps<T>) {
  const borderProps = !hideDivider
    ? { borderBottomWidth: '1', borderBottomColor: 'divider' }
    : undefined;
  return (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      px={{ base: 4, md: 6 }}
      py={4}
      {...borderProps}
    >
      {iconName && <Icon name={iconName} />}
      <Text
        typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
        flex="1"
        numberOfLines={1}
        mx={3}
      >
        {title}
      </Text>
      <Box display="flex" flexDirection="row" alignItems="center">
        <Box>
          <Text mr={1} typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            {activeOption.label ?? '-'}
          </Text>
          {activeOption.description && (
            <Typography.Body2 color="text-subdued">
              {activeOption.description ?? '-'}
            </Typography.Body2>
          )}
        </Box>
        <Icon name="ChevronDownMini" color="icon-subdued" size={20} />
      </Box>
    </Box>
  );
}

export default SelectTrigger;
