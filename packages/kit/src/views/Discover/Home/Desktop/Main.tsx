import type { FC } from 'react';
import { useLayoutEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Box, ScrollView } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useContextDapps } from '../context';

import { DAppCategories } from './DAppCategories';
import { EmptySkeletonContent } from './EmptySkeleton';
import { discoverUIEventBus } from './eventBus';
import { FlatListItem } from './FlatListItem';
import { ListHeader } from './ListHeader';

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
    paddingTop: 12,
  },
});

const ListHeaderComponent = () => (
  <Box>
    <ListHeader />
    <Box mt="8">
      <DAppCategories />
    </Box>
  </Box>
);

const ListEmptyComponent = () => <EmptySkeletonContent />;

type ListContentGroupsProps = { width: number };
const ListContentGroups: FC<ListContentGroupsProps> = ({ width }) => {
  const dapps = useContextDapps();
  return (
    <Box>
      {dapps.map((item) => (
        <FlatListItem key={item.label} data={item} width={width} />
      ))}
    </Box>
  );
};

const ListContentComponent = () => {
  const dapps = useContextDapps();
  const [width, setWidth] = useState(0);

  return (
    <Box onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {dapps.length === 0 || width === 0 ? (
        <ListEmptyComponent />
      ) : (
        <ListContentGroups width={width} />
      )}
    </Box>
  );
};

export const Main: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    if (platformEnv.isNative) {
      navigation.setOptions({
        title: intl.formatMessage({
          id: 'title__explore',
        }),
      });
    }
  }, [navigation, intl]);

  return (
    <Box flex="1" bg="background-default">
      <ScrollView
        contentContainerStyle={styles.container}
        scrollEventThrottle={100}
        onScroll={() => {
          discoverUIEventBus.emit('scroll');
        }}
      >
        <Box>
          <ListHeaderComponent />
          <ListContentComponent />
        </Box>
      </ScrollView>
    </Box>
  );
};
