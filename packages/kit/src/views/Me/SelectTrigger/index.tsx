import React from 'react';

import { Box, Icon, Typography } from '@onekeyhq/components';
import { SelectItem } from '@onekeyhq/components/src/Select';
import { Text } from '@onekeyhq/components/src/Typography';

type FieldProps<T> = {
  title: string;
  activeOption: SelectItem<T>;
  hideDivider?: boolean;
};

export function SelectTrigger<T>({
  title,
  activeOption,
  hideDivider,
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
      <Text
        typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
        flex="1"
        numberOfLines={1}
        mr="3"
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
        <Icon name="ChevronDownSolid" size={20} color="icon-default" />
      </Box>
    </Box>
  );
}

export default SelectTrigger;
