import React, { FC, useCallback, useRef, useState } from 'react';

import { View } from 'react-native';

// import NativePagingView from '@onekeyhq/app/src/views/NativePagingView';
import NativePagingView from '@onekeyhq/app/src/views/PagingView';
import PagingViewContrainer from '@onekeyhq/app/src/views/PagingViewContrainer';
import { Box, Pressable } from '@onekeyhq/components';

import AccountInfo, { FIXED_VERTICAL_HEADER_HEIGHT } from './AccountInfo';
import AssetsList from './AssetsList';

const PagingView: FC = () => {
  console.log();
  const ref = useRef<NativePagingView>(null);
  return (
    <NativePagingView
      ref={ref}
      defaultIndex={0}
      headerHeight={FIXED_VERTICAL_HEADER_HEIGHT}
      renderHeader={() => <AccountInfo />}
      renderTabBar={() => (
        <Box flexDirection="row" width="full" height={50} bgColor="amber.100">
          <Pressable
            flex={1}
            bgColor="blue.400"
            onPress={() => {
              ref.current?.setPageIndex(0);
            }}
          />
          <Pressable
            flex={1}
            bgColor="red.200"
            onPress={() => {
              ref.current?.setPageIndex(1);
            }}
          />
          <Pressable
            flex={1}
            bgColor="pink.400"
            onPress={() => {
              ref.current?.setPageIndex(2);
            }}
          />
        </Box>
      )}
    >
      <AssetsList singleton />
      <PagingViewContrainer />
      <AssetsList singleton />
    </NativePagingView>
  );
};

// const PagingView: FC = () => (
//   <NativePagingView
//     // style={{ flex: 1 }}
//     headerHeight={FIXED_VERTICAL_HEADER_HEIGHT}
//   >
//     <AccountInfo />
//     <View style={{ height: 50 }} />
//     <View>
//       <AssetsList singleton />
//       <PagingViewContrainer />
//       <PagingViewContrainer />
//     </View>
//   </NativePagingView>
// );

export default PagingView;
