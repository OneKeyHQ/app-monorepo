import { useContext, useMemo } from 'react';

import { Box, Pressable, ScrollView, Typography } from '@onekeyhq/components';

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

  if (!data.length) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 16,
      }}
    >
      <Box flexDirection="row">
        {data.map((item) => (
          <Pressable
            key={item._id}
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
        ))}
      </Box>
    </ScrollView>
  );
};
