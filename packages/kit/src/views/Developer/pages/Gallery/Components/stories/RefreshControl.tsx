import { useCallback, useState } from 'react';

import { RefreshControl, ScrollView, Text } from '@onekeyhq/components';

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
      h="$20"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text>Pull down to see RefreshControl indicator</Text>
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
