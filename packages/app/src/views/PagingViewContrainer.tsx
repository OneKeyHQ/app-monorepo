import React, { FC } from 'react';

import { Dimensions, FlatList, StyleSheet, Text, View } from 'react-native';

const DATA = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
];

// const PagingViewContrainer: FC = () => <Box flex={1} bgColor="red" />;
const styles = StyleSheet.create({
  header: {
    backgroundColor: 'green',
    width: Dimensions.get('window').width,
    // width: 300,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const PagingViewContrainer: FC = () => (
  <FlatList
    style={{ width: Dimensions.get('window').width, height: 400 }}
    data={DATA}
    renderItem={({ item }) => (
      <View style={{ backgroundColor: 'red', height: 50 }}>
        <Text>{item}</Text>
      </View>
    )}
  />
);

export default PagingViewContrainer;
