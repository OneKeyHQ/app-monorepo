import { FC, useCallback, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import { useIsVerticalLayout } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { DiscoverContext, ItemSource } from './context';
import { Desktop } from './Desktop';
import { Mobile } from './Mobile';
import { DiscoverProps } from './type';

const DiscoverPage: FC<DiscoverProps> = ({
  onItemSelect,
  onItemSelectHistory,
}) => {
  const [categoryId, setCategoryId] = useState('');
  const isSmall = useIsVerticalLayout();
  const [itemSource, setItemSource] = useState<ItemSource>('Favorites');

  useFocusEffect(
    useCallback(() => {
      backgroundApiProxy.serviceDiscover.getDapps();
    }, []),
  );

  return (
    <DiscoverContext.Provider
      value={{
        categoryId,
        setCategoryId,
        itemSource,
        setItemSource,
        onItemSelect,
        onItemSelectHistory,
      }}
    >
      {isSmall ? <Mobile /> : <Desktop />}
    </DiscoverContext.Provider>
  );
};

export default DiscoverPage;
