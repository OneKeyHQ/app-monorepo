import React, { ComponentProps, FC } from 'react';

import { chunk } from 'lodash';
import { Column, Row } from 'native-base';

import {
  Box,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { NFTObject, NFTsGroup } from '../type';

type ItemProps = { item: NFTObject; width: number } & ComponentProps<
  typeof Box
>;

export const NFTItem: FC<ItemProps> = ({ width, item, ...rest }) => {
  const isSmallScreen = useIsVerticalLayout();
  const padding = isSmallScreen ? 8 : 12;
  const contentWidth = width - padding * 2;

  return (
    <Box
      bg="surface-default"
      borderRadius="12px"
      padding={`${padding}px`}
      {...rest}
    >
      <Box flex={1} bgColor="amber.500">
        {/* <Image src={item.source} flex={1} /> */}
      </Box>
      <Text typography="Body2" mt="8px" width={contentWidth} numberOfLines={1}>
        {item.title}
      </Text>
    </Box>
  );
};

type GroupProps = { groupItem: NFTsGroup; width: number } & ComponentProps<
  typeof Pressable
>;
export const NFTGroupItem: FC<GroupProps> = ({ width, groupItem, ...rest }) => {
  const isSmallScreen = useIsVerticalLayout();
  const padding = isSmallScreen ? 8 : 12;
  const contentWidth = width - padding * 2;
  const subItemWidth = (contentWidth - 9) / 2;

  if (groupItem.items.length > 1) {
    const numCol = 2;
    const colDatas = chunk(groupItem.items.slice(0, 4), numCol);
    return (
      <Pressable
        bgColor="surface-default"
        borderRadius="12px"
        padding={`${padding}px`}
        {...rest}
      >
        <Column flex={1} space="9px">
          {colDatas.map((rowItems, colIndex) => (
            <Row key={`colIndex${colIndex}`} space="9px">
              {rowItems.map((item, index) => (
                <Box
                  borderRadius="6px"
                  key={`rowIndex${index}`}
                  bgColor="red.100"
                  width={`${subItemWidth}px`}
                  height={`${subItemWidth}px`}
                >
                  {/* <Image src={item.source} /> */}
                </Box>
              ))}
            </Row>
          ))}
        </Column>

        <Text
          typography="Body2"
          mt="8px"
          width={contentWidth}
          numberOfLines={1}
        >
          {groupItem.title}
        </Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      bg="surface-default"
      borderRadius="12px"
      padding={`${padding}px`}
      {...rest}
    >
      <Box flex={1} bgColor="amber.100" />
      <Text typography="Body2" mt="8px" width={contentWidth} numberOfLines={1}>
        {groupItem.title}
      </Text>
    </Pressable>
  );
};
