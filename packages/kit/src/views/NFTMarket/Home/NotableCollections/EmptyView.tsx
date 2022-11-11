import {
  Box,
  CustomSkeleton,
  FlatList,
  Skeleton,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const EmptyView = () => {
  const isVerticalLayout = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();

  const data = isVerticalLayout ? [1, 2] : [1, 2, 3, 4, 5];

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={data}
      renderItem={() => (
        <Box mr="16px" flexDirection="column">
          <CustomSkeleton
            width={platformEnv.isNative ? `${screenWidth - 48}px` : '220px'}
            height={platformEnv.isNative ? `${screenWidth - 48}px` : '147px'}
            borderRadius="12px"
          />
          <Box mt="8px">
            <Skeleton shape="Body1" />
          </Box>
          <Box mt="4px">
            <Skeleton shape="Body2" />
          </Box>
        </Box>
      )}
      keyExtractor={(item) => `${item}`}
    />
  );
};

export default EmptyView;
