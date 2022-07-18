import React, { FC } from 'react';

import { Dimensions, StyleSheet, Text, View } from 'react-native';

import { Box, useTheme } from '@onekeyhq/components';
import AccountInfo from '@onekeyhq/kit/src/views/Wallet/AccountInfo';

const styles = StyleSheet.create({
  header: {
    backgroundColor: 'green',
    width: Dimensions.get('window').width,
    // width: 300,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const PagingViewHeader: FC = () => {
  const { themeVariant } = useTheme();
  console.log('====================================');
  console.log('themeVariant = ', themeVariant);
  console.log('====================================');
  return (
    <Box>
      <Text>head22er</Text>
    </Box>
  );
};

// const PagingViewHeader: FC = () => (
//   <View style={styles.header}>
//     <Text>head22er</Text>
//   </View>
// );

// const PagingViewHeader: FC = () => (
//   <Box>
//     <AccountInfo />
//   </Box>
// );

export default PagingViewHeader;
