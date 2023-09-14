import { useCallback, useContext, useMemo, useState } from 'react';

import { ToggleButtonGroup } from '@onekeyhq/components';

import { DiscoverContext } from '../context';

export const DAppCategories = () => {
  const { categoryId, setCategoryId, categories } = useContext(DiscoverContext);
  const data = useMemo(() => {
    if (!categories) {
      return [];
    }
    return categories;
  }, [categories]);

  const [selectedIndex, setSelectedIndex] = useState(() =>
    data.findIndex((item) => item.id === categoryId),
  );

  const onButtonPress = useCallback(
    (index: number) => {
      const { id } = data[index];
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
    <ToggleButtonGroup
      px="4"
      buttons={buttons}
      selectedIndex={selectedIndex}
      onButtonPress={onButtonPress}
      bg="background-default"
    />
  );
};
