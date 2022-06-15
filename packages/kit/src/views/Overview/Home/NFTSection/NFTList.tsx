import React, { FC } from 'react';

import { chunk } from 'lodash';
import { Column, Row } from 'native-base';
import { useWindowDimensions } from 'react-native';

import { Badge, Box, Text, useIsVerticalLayout } from '@onekeyhq/components';

import { NFTDatas } from './MockData';
import { NFTGroupItem, NFTItem } from './NFTItem';

const OVERVIEW_MAX_WIDTH = 768;

type GridListProps = {
  datas: any[];
  numColumns: number;
  space: number;
  renderItem: (item: any, index: number) => JSX.Element;
};

const GridList: FC<GridListProps> = ({
  datas,
  numColumns,
  space,
  renderItem,
}) => {
  const colDatas = chunk(datas, numColumns);
  return (
    <Column width="100%" bgColor="background-default" space={`${space}px`}>
      {colDatas.map((rowItems, colIndex) => (
        <Row key={`colIndex${colIndex}`} space={`${space}px`}>
          {rowItems.map((item, index) => renderItem(item, index))}
        </Row>
      ))}
    </Column>
  );
};

const ShrinkList = () => {
  const isSmallScreen = useIsVerticalLayout();
  const { width } = useWindowDimensions();
  const screenWidth = isSmallScreen
    ? width
    : Math.min(width - 224, OVERVIEW_MAX_WIDTH);
  const space = isSmallScreen ? 16 : 20;
  const itemWidth = isSmallScreen ? (width - space * 3) / 2 : 177;
  const itemHeight = isSmallScreen
    ? itemWidth + 20 + (isSmallScreen ? 8 : 12)
    : 210;
  const numColumns = isSmallScreen ? 2 : Math.floor(screenWidth / itemWidth);
  return (
    <GridList
      datas={NFTDatas}
      space={space}
      numColumns={numColumns}
      renderItem={(item, index) => (
        <NFTGroupItem
          key={`rowIndex${index}`}
          groupItem={item}
          width={itemWidth}
          height={itemHeight}
        />
      )}
    />
  );
};

const ExpandList = () => {
  const isSmallScreen = useIsVerticalLayout();
  const { width } = useWindowDimensions();
  const screenWidth = isSmallScreen
    ? width
    : Math.min(width - 224, OVERVIEW_MAX_WIDTH);
  const contentWidth = isSmallScreen ? screenWidth - 16 * 2 : screenWidth;

  const space = isSmallScreen ? 16 : 20;
  const itemWidth = isSmallScreen ? (width - space * 3) / 2 : 177;
  const itemHeight = isSmallScreen
    ? itemWidth + 20 + (isSmallScreen ? 8 : 12)
    : 210;
  const numColumns = isSmallScreen ? 2 : Math.floor(screenWidth / itemWidth);

  return (
    <Column width="100%" bgColor="background-default" space={`${24}px`}>
      {NFTDatas.map((groupItem, groupIndex) => {
        const colDatas = chunk(groupItem.items, numColumns);
        return (
          <Box key={`groupItem${groupIndex}`}>
            <Box
              flexDirection="row"
              alignItems="center"
              paddingRight="8px"
              mb="8px"
            >
              <Box
                size="20px"
                bgColor="blue.300"
                borderRadius="full"
                mr="8px"
              />
              <Text
                typography="Subheading"
                mr="12px"
                numberOfLines={1}
                maxWidth={contentWidth - 68}
              >
                {groupItem.title}
              </Text>
              <Badge
                title={`${groupItem.items.length}`}
                type="default"
                size="sm"
              />
            </Box>
            <GridList
              datas={colDatas}
              space={space}
              numColumns={numColumns}
              renderItem={(item, index) => (
                <NFTItem
                  key={`rowIndex${index}`}
                  item={item}
                  width={itemWidth}
                  height={itemHeight}
                />
              )}
            />
          </Box>
        );
      })}
    </Column>
  );
};

const NFTList = ({ expand }: { expand: boolean }) =>
  expand ? <ExpandList /> : <ShrinkList />;
export default NFTList;
