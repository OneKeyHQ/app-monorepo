import { useCallback, useContext, useMemo, useState } from 'react';

import { Box, ToggleButtonGroup } from '@onekeyhq/components';

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

  const [selectedIndex, setSelectedIndex] = useState(() =>
    data.findIndex((item) => item._id === categoryId),
  );

  const onButtonPress = useCallback(
    (index: number) => {
      const id = data[index]._id;
      setCategoryId(id);
      setSelectedIndex(index);
    },
    [data, setCategoryId],
  );

  const buttons = useMemo(
    () => data.map((item) => ({ text: item.name }), []),
    [data],
  );

  if (!data.length) {
    return null;
  }
  return (
    <Box px="4">
      <ToggleButtonGroup
        buttons={buttons}
        selectedIndex={selectedIndex}
        onButtonPress={onButtonPress}
        bg="background-default"
      />
    </Box>
  );
};
