import { useCallback, useContext, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { ToggleButtonGroup } from '@onekeyhq/components';

import { DiscoverContext } from '../context';

import type { CategoryType } from '../../type';

export const DAppCategories = () => {
  const intl = useIntl();
  const { categoryId, setCategoryId, categories } = useContext(DiscoverContext);

  const data = useMemo<CategoryType[]>(() => {
    if (!categories) {
      return [];
    }
    return [{ name: intl.formatMessage({ id: 'msg__mine' }), id: '' }].concat(
      categories,
    );
  }, [categories, intl]);

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
    () => data.map((item) => ({ text: item.name })),
    [data],
  );

  if (!data.length) {
    return null;
  }
  return (
    <ToggleButtonGroup
      px="8"
      buttons={buttons}
      selectedIndex={selectedIndex}
      onButtonPress={onButtonPress}
      bg="background-default"
    />
  );
};
