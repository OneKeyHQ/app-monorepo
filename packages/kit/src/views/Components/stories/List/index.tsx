/* eslint-disable no-nested-ternary */
import React, { FC, ReactNode } from 'react';

import { IBoxProps } from 'native-base';

import {
  Box,
  FlatList,
  HStack,
  SectionList,
  Text,
  VStack,
} from '@onekeyhq/components';

const DATA = [
  {
    id: 'bd7acbea-c1b1-46c2-aed5-3ad53abb28ba',
    type: 'text',
    label: 'label',
    description: 'description',
  },
  {
    id: '3ac68afc-c605-48d3-a4f8-fbd91aa97f63',
    type: 'text',
    label: 'label',
    description: 'description',
  },
  {
    id: '58694a0f-3da1-471f-bd96-145571e29d72',
    type: 'text',
    label: 'label',
    description: 'description',
  },
];

/* 
  Column
  The children element of Item
*/

type ColumnProps = {
  type?: 'text' | string | undefined;
  label?: string | ReactNode;
  description?: string | ReactNode;
} & IBoxProps;

const Column: FC<ColumnProps> = ({
  type,
  label,
  description,
  children,
  ...rest
}) => {
  // Text column
  if (type === 'text')
    return (
      <VStack space={1} {...rest}>
        {label ? (
          React.isValidElement(label) ? (
            label
          ) : (
            <Text typography="Body1Strong">{label}</Text>
          )
        ) : null}
        {description ? (
          React.isValidElement(description) ? (
            description
          ) : (
            <Text typography="Body2" color="text-subdued">
              {description}
            </Text>
          )
        ) : null}
      </VStack>
    );

  // Custom column
  return <>{children}</>;
};

/* 
  Item
  The children element of FlatList
*/

type ItemProps = {
  onPress?: () => void;
} & IBoxProps;

const Item: FC<ItemProps> = ({ type, label, description }) => (
  <HStack p={2} space={3}>
    <Item.Column type={type} label={label} description={description} />
  </HStack>
);

Item.Column = Column;

const ListGallery = () => {
  const renderItem = ({ item }) => (
    <Item type={item.type} label={item.label} description={item.description} />
  );
  return (
    <>
      <Box p={4}>
        <FlatList
          ListHeaderComponent={
            <HStack p={2}>
              <Text typography="Heading">Heading</Text>
            </HStack>
          }
          data={DATA}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <Box h={2} />}
          m={-2}
        />
      </Box>
    </>
  );
};

export default ListGallery;
