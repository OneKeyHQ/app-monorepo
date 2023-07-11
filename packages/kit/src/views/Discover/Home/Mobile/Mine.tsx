import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Box, Empty, FlatList } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppSelector } from '../../../../hooks';
import { useTaggedDapps } from '../../hooks';
import CardView from '../CardView';
import { DiscoverContext } from '../context';

import { EmptySkeleton } from './EmptySkeleton';
import { ListHeader } from './ListHeader';

import type { SectionDataType, TagDappsType } from '../../type';
import type { ListRenderItem } from 'react-native';

const styles = StyleSheet.create({
  listContentContainer: {
    paddingBottom: 62,
    paddingTop: 12,
  },
});

const ListEmptyComponent = () => {
  const home = useAppSelector((s) => s.discover.home);
  return home ? <Empty title="" /> : <EmptySkeleton />;
};

const ListHeaderComponent = () => <ListHeader showDappCategories />;

export const Mine = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const fullDapps = useTaggedDapps();
  const [dapps, setDapps] = useState<TagDappsType[]>([]);
  const [total, setTotal] = useState<number>(10);
  const { onItemSelect } = useContext(DiscoverContext);

  const data = useMemo(() => {
    const items = dapps.map((item) => ({
      title: item.label,
      data: item.items,
      tagId: item.id,
      _title: item._label,
    }));
    return total < items.length ? items.slice(0, total) : items;
  }, [dapps, total]);

  useEffect(() => {
    if (platformEnv.isNative) {
      navigation.setOptions({
        title: intl.formatMessage({
          id: 'title__explore',
        }),
      });
    }
    setTimeout(() => {
      setDapps(fullDapps);
    });
  }, [navigation, intl, fullDapps]);

  const renderItem: ListRenderItem<SectionDataType> = useCallback(
    ({ item }) => <CardView {...item} onItemSelect={onItemSelect} />,
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
        keyExtractor={(item, index) => `${item.title ?? ''}${index}`}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
      />
    </Box>
  );
};
