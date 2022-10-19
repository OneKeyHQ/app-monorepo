import { Box, CustomSkeleton, FlatList } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const EmptySkeleton = () => (
  <FlatList
    contentContainerStyle={{
      paddingBottom: 24,
      paddingTop: 24,
    }}
    data={[1, 2, 3, 4, 5, 6, 7, 8]}
    ListHeaderComponent={
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={platformEnv.isDesktop}
        contentContainerStyle={{
          paddingHorizontal: 16,
          marginBottom: 16,
        }}
        data={[1, 2, 3, 4, 5, 6, 7]}
        ItemSeparatorComponent={() => <Box w="3" />}
        renderItem={() => (
          <Box h="7" w="12" borderRadius={12} overflow="hidden">
            <CustomSkeleton />
          </Box>
        )}
      />
    }
    renderItem={() => (
      <Box px="4" w="full">
        <Box h="4" borderRadius={8} mb="3" overflow="hidden">
          <CustomSkeleton />
        </Box>
        <Box h="3" borderRadius={6} overflow="hidden" width="70%">
          <CustomSkeleton />
        </Box>
      </Box>
    )}
    keyExtractor={(item) => String(item)}
    ItemSeparatorComponent={() => <Box h="8" />}
  />
);
