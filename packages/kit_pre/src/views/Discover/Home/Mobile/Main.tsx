import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Box, FlatList } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DiscoverContext, useContextDapps } from '../context';

import { EmptySkeletonContent } from './EmptySkeleton';
import { FlatListItem } from './FlatListItem';
import { ListHeader } from './ListHeader';

import type { GroupDappsType } from '../../type';
import type { ListRenderItem } from 'react-native';

const styles = StyleSheet.create({
  listContentContainer: {
    paddingBottom: 62,
    paddingTop: 12,
  },
});

const ListEmptyComponent = () => (
  <Box mt="4">
    <EmptySkeletonContent />
  </Box>
);

const ListHeaderComponent = () => <ListHeader showDappCategories />;

export const Main = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const dapps = useContextDapps();
  const [total, setTotal] = useState<number>(10);
  const { onItemSelect } = useContext(DiscoverContext);

  const data = useMemo(
    () => (total < dapps.length ? dapps.slice(0, total) : dapps),
    [dapps, total],
  );

  useEffect(() => {
    if (platformEnv.isNative) {
      navigation.setOptions({
        title: intl.formatMessage({
          id: 'title__explore',
        }),
      });
    }
  }, [navigation, intl]);

  const renderItem: ListRenderItem<GroupDappsType> = useCallback(
    ({ item }) => (
      <FlatListItem key={item.label} data={item} onItemSelect={onItemSelect} />
    ),
    [onItemSelect],
  );

  const onEndReached = useCallback(() => {
    if (dapps.length >= total) {
      setTotal(total * 2);
    }
  }, [dapps.length, total]);

  return (
    <Box flex="1" bg="background-default">
      <FlatList
        contentContainerStyle={styles.listContentContainer}
        data={data}
        removeClippedSubviews
        windowSize={10}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.label}`}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
      />
    </Box>
  );
};
