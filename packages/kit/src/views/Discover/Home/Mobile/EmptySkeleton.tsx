import type { ComponentType, FC, ReactElement } from 'react';

import { Box, CustomSkeleton, FlatList, HStack } from '@onekeyhq/components';

type EmptySkeletonContentProps = {
  ListHeaderComponent?: ComponentType<any> | ReactElement | null | undefined;
};

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

const ListHeaderComponent = () => (
  <HStack px="4" my="4" space={3}>
    {[1, 2, 3, 4].map((item) => (
      <Box key={item} h="7" w="12" borderRadius={12} overflow="hidden">
        <CustomSkeleton />
      </Box>
    ))}
  </HStack>
);

export const EmptySkeleton = () => (
  <EmptySkeletonContent ListHeaderComponent={ListHeaderComponent} />
);
