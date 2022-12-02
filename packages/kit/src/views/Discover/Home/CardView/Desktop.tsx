import { FC, useCallback, useMemo } from 'react';

import { ListRenderItem, useWindowDimensions } from 'react-native';

import { Box, FlatList, Pressable, Typography } from '@onekeyhq/components';

import { Chains } from '../../Chains';
import DAppIcon from '../../DAppIcon';
import { DAppItemType, SectionDataType } from '../../type';
import { SectionTitle } from '../TitleView';

export const Desktop: FC<SectionDataType> = ({
  title,
  data,
  onItemSelect,
  tagId,
}) => {
  const { width } = useWindowDimensions();
  const screenWidth = width - 270 - 48;
  const minWidth = 250;
  const numColumns = Math.floor(screenWidth / minWidth);
  const cardWidth = screenWidth / numColumns;
  const filterData = data.slice(0, 8);

  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item }) => (
      <Box
        width={cardWidth}
        maxWidth={cardWidth}
        minWidth={cardWidth}
        height={156}
        paddingX="2"
        justifyContent="center"
        alignItems="center"
      >
        <Pressable
          bgColor="surface-default"
          flexDirection="column"
          borderRadius="12px"
          padding="4"
          width={cardWidth - 16}
          height={144}
          borderWidth={1}
          _hover={{ bgColor: 'surface-hovered' }}
          borderColor="border-subdued"
          onPress={() => {
            if (onItemSelect) {
              onItemSelect(item);
            }
          }}
        >
          <Box flexDirection="row">
            <DAppIcon
              size={48}
              url={item.logoURL}
              networkIds={item.networkIds}
            />
            <Box ml="3" flex="1">
              <Typography.Body2Strong numberOfLines={1} mb="1" flex="1">
                {item.name}
              </Typography.Body2Strong>
              <Chains networkIds={item.networkIds} />
            </Box>
          </Box>
          <Typography.Caption
            mt="3"
            numberOfLines={2}
            textAlign="left"
            color="text-subdued"
          >
            {item.subtitle}
          </Typography.Caption>
        </Pressable>
      </Box>
    ),
    [cardWidth, onItemSelect],
  );

  const flatList = useMemo(
    () => (
      <FlatList
        paddingLeft="24px"
        data={filterData}
        removeClippedSubviews
        windowSize={5}
        renderItem={renderItem}
        numColumns={numColumns}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => `${numColumns}key${index}${item._id}`}
        key={`key${numColumns}`}
      />
    ),
    [filterData, numColumns, renderItem],
  );
  return (
    <Box width="100%" mt="32px">
      <SectionTitle title={title} tagId={tagId} onItemSelect={onItemSelect} />
      {flatList}
    </Box>
  );
};
