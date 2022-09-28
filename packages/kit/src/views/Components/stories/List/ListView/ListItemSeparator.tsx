import React, { FC } from 'react';

import { StyleSheet } from 'react-native';

import { Box } from '@onekeyhq/components';

export type ListItemSeparatorProps = {
  showDivider?: boolean;
};

const ListItemSeparator: FC<ListItemSeparatorProps> = ({ showDivider }) => (
  <>
    {showDivider ? (
      <Box
        my={1}
        mx={2}
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderColor="divider"
      />
    ) : (
      <Box h={2} />
    )}
  </>
);

export default ListItemSeparator;
