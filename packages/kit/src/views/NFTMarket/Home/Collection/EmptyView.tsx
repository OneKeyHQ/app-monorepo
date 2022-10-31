import {
  Box,
  CustomSkeleton,
  FlatList,
  useIsVerticalLayout,
} from '@onekeyhq/components';

const EmptyView = () => {
  const isSmallScreen = useIsVerticalLayout();
  const imageW = isSmallScreen ? 280 : 220;
  const imageH = isSmallScreen ? 280 : 146;
  return (
    <FlatList
      horizontal
      ListHeaderComponent={() => <Box width="16px" />}
      contentContainerStyle={{
        paddingBottom: 16,
        paddingTop: 16,
      }}
      data={[1, 2, 3]}
      renderItem={() => (
        <Box
          width={`${imageW}px`}
          height={`${imageH + 56}px`}
          mr="10px"
          flexDirection="column"
        >
          <CustomSkeleton
            width={`${imageW}px`}
            height={`${imageH}px`}
            borderRadius="12px"
          />
          <CustomSkeleton
            width={isSmallScreen ? '260px' : '200px'}
            height="24px"
            mt="8px"
            borderRadius="12px"
          />
          <CustomSkeleton
            width="144px"
            height="20px"
            mt="4px"
            borderRadius="10px"
          />
        </Box>
      )}
      keyExtractor={(item) => `${item}`}
    />
  );
};

export default EmptyView;
