import React, { FC } from 'react';

import {
  Box,
  Icon,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { SelectItem } from '@onekeyhq/components/src/Select';

type FieldProps = {
  title: string;
  activeOption: SelectItem;
  hideDivider?: boolean;
};

export const SelectTrigger: FC<FieldProps> = ({
  title,
  activeOption,
  hideDivider,
}) => {
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
      zIndex={99}
      {...borderProps}
    >
      <Typography.Body1>{title}</Typography.Body1>
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
};

export default SelectTrigger;
