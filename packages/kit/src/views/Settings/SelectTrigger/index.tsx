import React from 'react';

import {
  Box,
  Icon,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { SelectItem } from '@onekeyhq/components/src/Select';

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
  const isSmallScreen = useIsVerticalLayout();
  const borderProps = !hideDivider
    ? { borderBottomWidth: '1', borderBottomColor: 'divider' }
    : undefined;
  return (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      px="4"
      py="3.5"
      {...borderProps}
    >
      <Typography.Body1 flex="1" numberOfLines={1} mr="3">
        {title}
      </Typography.Body1>
      <Box display="flex" flexDirection="row" alignItems="center" mr="1">
        <Box>
          {isSmallScreen ? (
            <Typography.Body1 numberOfLines={1}>
              {activeOption.label ?? '-'}
            </Typography.Body1>
          ) : (
            <Typography.Body2 numberOfLines={1}>
              {activeOption.label ?? '-'}
            </Typography.Body2>
          )}
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
