import React, { FC, useMemo } from 'react';

import { Column } from 'native-base';

import {
  Box,
  CustomSkeleton,
  FlatList,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';

type Props = {
  isTab?: boolean;
  numberOfData: number;
  ListHeaderComponent?: () => React.ReactElement;
};
const EmptyView: FC<Props> = ({ numberOfData, isTab, ListHeaderComponent }) => {
  const isSmallScreen = useIsVerticalLayout();

  const { bottom } = useSafeAreaInsets();
  const height = isSmallScreen ? 56 : 64;

  const listData = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < numberOfData; i += 1) {
      arr.push(i);
    }
    return arr;
  }, [numberOfData]);

  const avatarSize = isSmallScreen ? 56 : 40;
  const padding = isSmallScreen ? 16 : 16;
  return (
    <FlatList
      ListHeaderComponent={ListHeaderComponent}
      data={listData}
      renderItem={() => (
        <Box
          paddingX={`${padding}px`}
          width="full"
          height={`${height}px`}
          flexDirection="row"
          alignItems="center"
        >
          <CustomSkeleton
            width={`${avatarSize}px`}
            height={`${avatarSize}px`}
            borderRadius="12px"
          />
          <Column ml="12px" space="4px" justifyContent="center">
            <CustomSkeleton width="153px" height="24px" borderRadius="12px" />
            <CustomSkeleton width="86px" height="20px" borderRadius="10px" />
          </Column>
        </Box>
      )}
      ItemSeparatorComponent={() => <Box height="20px" />}
      ListFooterComponent={() =>
        isTab === false ? <Box height={`${bottom}px`} /> : null
      }
      keyExtractor={(item) => `${item}`}
    />
  );
};

export default EmptyView;
