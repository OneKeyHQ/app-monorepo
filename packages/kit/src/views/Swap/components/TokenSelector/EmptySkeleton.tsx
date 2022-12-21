import { useCallback } from 'react';

import { Box, CustomSkeleton, FlatList } from '@onekeyhq/components';

const ItemSeparatorComponent4 = () => <Box h="4" />;
const ItemSeparatorComponent3 = () => <Box h="3" />;

export const EmptySkeleton = () => {
  const renderItem = useCallback(
    () => (
      <Box h="7" w="12" borderRadius={12} overflow="hidden">
        <CustomSkeleton />
      </Box>
    ),
    [],
  );
  return (
    <FlatList
      data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
      ListHeaderComponent={
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            marginBottom: 16,
          }}
          data={[1, 2, 3, 4]}
          ItemSeparatorComponent={ItemSeparatorComponent3}
          renderItem={renderItem}
        />
      }
      renderItem={() => (
        <Box w="full" flexDirection="row">
          <Box w="10" h="10" borderRadius="full" overflow="hidden" mr="3">
            <CustomSkeleton />
          </Box>
          <Box flex="1">
            <Box h="4" borderRadius={8} w="40%" mb="2" overflow="hidden">
              <CustomSkeleton />
            </Box>
            <Box h="3" borderRadius={6} overflow="hidden" width="70%">
              <CustomSkeleton />
            </Box>
          </Box>
        </Box>
      )}
      keyExtractor={(item) => String(item)}
      ItemSeparatorComponent={ItemSeparatorComponent4}
      showsVerticalScrollIndicator={false}
    />
  );
};
