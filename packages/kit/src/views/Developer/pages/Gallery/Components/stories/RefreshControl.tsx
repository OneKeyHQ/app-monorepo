import { useCallback, useState } from 'react';

import {
  RefreshControl,
  ScrollView,
  SizableText,
  Stack,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const Demo = () => {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);
  return (
    <ScrollView
      h={200}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Stack h={250} alignItems="center" justifyContent="center">
        <SizableText>Pull down to see RefreshControl indicator</SizableText>
      </Stack>
    </ScrollView>
  );
};

const RefreshControllerGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    scrollEnabled={false}
    elements={[
      {
        title: 'Default',
        element: <Demo />,
      },
    ]}
  />
);

export default RefreshControllerGallery;
