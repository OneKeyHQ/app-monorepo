import type { ComponentType, FC, ReactElement } from 'react';

import { Box, CustomSkeleton, FlatList } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type EmptySkeletonContentProps = {
  ListHeaderComponent: ComponentType<any> | ReactElement | null | undefined;
};

const ItemSeparatorComponent3 = () => <Box h="3" />;
const ItemSeparatorComponent4 = () => <Box h="4" />;

export const EmptySkeletonContent: FC<EmptySkeletonContentProps> = ({
  ListHeaderComponent,
}) => (
  <FlatList
    contentContainerStyle={{
      paddingBottom: 24,
      paddingTop: 24,
    }}
    ListHeaderComponent={ListHeaderComponent}
    data={[1, 2, 3, 4]}
    renderItem={() => (
      <Box px="4" w="full" flexDirection="row" alignItems="center">
        <Box mr="3">
          <Box w="12" h="12" borderRadius={12} overflow="hidden">
            <CustomSkeleton />
          </Box>
        </Box>
        <Box flex="1">
          <Box h="4" borderRadius={8} mb="3" overflow="hidden">
            <CustomSkeleton />
          </Box>
          <Box h="3" borderRadius={6} overflow="hidden" width="70%">
            <CustomSkeleton />
          </Box>
        </Box>
      </Box>
    )}
    showsHorizontalScrollIndicator={false}
    showsVerticalScrollIndicator={false}
    keyExtractor={(item) => String(item)}
    ItemSeparatorComponent={ItemSeparatorComponent4}
  />
);

export const EmptySkeleton = () => (
  <EmptySkeletonContent
    ListHeaderComponent={
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={platformEnv.isDesktop}
        contentContainerStyle={{
          paddingHorizontal: 16,
          marginBottom: 16,
        }}
        data={[1, 2, 3, 4]}
        ItemSeparatorComponent={ItemSeparatorComponent3}
        renderItem={() => (
          <Box h="7" w="12" borderRadius={12} overflow="hidden">
            <CustomSkeleton />
          </Box>
        )}
      />
    }
  />
);
