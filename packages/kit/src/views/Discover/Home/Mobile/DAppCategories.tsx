import { useContext, useMemo } from 'react';

import { ListRenderItem } from 'react-native';

import { FlatList, Pressable, Typography } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useCategories } from '../../hooks';
import { DiscoverContext } from '../context';

export const DAppCategories = () => {
  const { categoryId, setCategoryId } = useContext(DiscoverContext);
  const categories = useCategories();

  const data = useMemo(() => {
    if (!categories) {
      return [];
    }
    return [{ name: 'Mine', _id: '' }].concat(categories);
  }, [categories]);

  const renderItem: ListRenderItem<{ name: string; _id: string }> = ({
    item,
  }) => (
    <Pressable
      py="2"
      px="3"
      bg={categoryId === item._id ? 'surface-selected' : undefined}
      onPress={() => setCategoryId(item._id)}
      borderRadius={12}
    >
      <Typography.Body2
        color={categoryId === item._id ? 'text-default' : 'text-subdued'}
      >
        {item.name}
      </Typography.Body2>
    </Pressable>
  );
  if (!data.length) {
    return null;
  }
  return (
    <FlatList
      horizontal
      data={data}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={platformEnv.isDesktop}
      keyExtractor={(item) => item._id}
      contentContainerStyle={{
        paddingHorizontal: 16,
      }}
    />
  );
};
