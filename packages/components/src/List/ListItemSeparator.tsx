import type { FC } from 'react';

import { StyleSheet } from 'react-native';

import { Box } from '@onekeyhq/components';

interface ListItemSeparatorProps {
  showDivider?: boolean;
}

const ListItemSeparator: FC<ListItemSeparatorProps> = ({ showDivider }) =>
  showDivider ? (
    <Box
      mx={2}
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderColor="divider"
    />
  ) : null;

export default ListItemSeparator;
