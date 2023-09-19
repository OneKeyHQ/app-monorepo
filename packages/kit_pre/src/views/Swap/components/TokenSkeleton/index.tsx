import { Box, CustomSkeleton, FlatList, HStack } from '@onekeyhq/components';

const ItemSeparatorComponent4 = () => <Box h="4" />;

const ListHeaderComponent = () => {
  const data = [1, 2, 3, 4];
  return (
    <HStack mb="4" space={1}>
      {data.map((i) => (
        <Box key={i} h="7" w="12" borderRadius={12} overflow="hidden">
          <CustomSkeleton />
        </Box>
      ))}
    </HStack>
  );
};

export const EmptySkeleton = () => (
  <FlatList
    data={[1, 2, 3]}
    ListHeaderComponent={ListHeaderComponent}
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

export const LoadingSkeleton = () => (
  <FlatList
    data={[1, 2, 3]}
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
