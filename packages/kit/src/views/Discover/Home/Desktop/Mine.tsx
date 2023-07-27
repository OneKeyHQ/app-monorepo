import type { FC } from 'react';
import { useContext, useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Box, Empty, ScrollView } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppSelector } from '../../../../hooks';
import { useTaggedDapps } from '../../hooks';
import CardView from '../CardView';
import { DiscoverContext } from '../context';

import { DAppCategories } from './DAppCategories';
import { EmptySkeleton } from './EmptySkeleton';
import { discoverUIEventBus } from './eventBus';
import { ListHeader } from './ListHeader';

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
    paddingTop: 12,
  },
});

const ListHeaderComponent = () => {
  const home = useAppSelector((s) => s.discover.home);
  if (!home) {
    return null;
  }
  return (
    <Box>
      <ListHeader />
      <Box mt="8">
        <DAppCategories />
      </Box>
    </Box>
  );
};

const ListEmptyComponent = () => {
  const home = useAppSelector((s) => s.discover.home);
  return home ? <Empty title="" /> : <EmptySkeleton />;
};

export const Mine: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const dapps = useTaggedDapps();
  const { onItemSelect } = useContext(DiscoverContext);

  const data = useMemo(
    () =>
      dapps.map((item) => ({
        title: item.label,
        data: item.items,
        tagId: item.id,
        _title: item._label,
      })),
    [dapps],
  );

  useLayoutEffect(() => {
    if (platformEnv.isNative) {
      navigation.setOptions({
        title: intl.formatMessage({
          id: 'title__explore',
        }),
      });
    }
  }, [navigation, intl]);

  if (dapps.length === 0) {
    return <ListEmptyComponent />;
  }

  return (
    <Box flex="1" bg="background-default">
      <ScrollView
        contentContainerStyle={styles.container}
        scrollEventThrottle={100}
        onScroll={() => {
          discoverUIEventBus.emit('scroll');
        }}
      >
        <ListHeaderComponent />
        {data.map((item) => (
          <CardView key={item.title} {...item} onItemSelect={onItemSelect} />
        ))}
      </ScrollView>
    </Box>
  );
};
