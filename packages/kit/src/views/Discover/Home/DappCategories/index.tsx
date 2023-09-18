import { useCallback, useContext, useMemo } from 'react';

import { ToggleButtonGroup } from '@onekeyhq/components';

import { DiscoverContext } from '../context';

export const DAppCategories = () => {
  const { categoryId, setCategoryId, categories } = useContext(DiscoverContext);

  const selectedIndex = useMemo(() => {
    const result = categories.findIndex((item) => item.id === categoryId);
    return Math.max(0, result);
  }, [categories, categoryId]);

  const onButtonPress = useCallback(
    (index: number) => {
      const { id } = categories[index];
      setCategoryId(id);
    },
    [categories, setCategoryId],
  );

  const buttons = useMemo(
    () => categories.map((item) => ({ text: item.name }), []),
    [categories],
  );

  if (!categories.length) {
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
