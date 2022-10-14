import { FC, useState } from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import { DiscoverContext, ItemSource } from './context';
import { DiscoverDesktop } from './DiscoverDesktop';
import { DiscoverMobile } from './DiscoverMobile';
import { DiscoverProps } from './type';

const DiscoverPage: FC<DiscoverProps> = ({ ...props }) => {
  const [categoryId, setCategoryId] = useState('');
  const isSmall = useIsVerticalLayout();
  const [itemSource, setItemSource] = useState<ItemSource>('Favorites');
  return (
    <DiscoverContext.Provider
      value={{
        categoryId,
        setCategoryId,
        itemSource,
        setItemSource,
        onItemSelect: props.onItemSelect,
        onItemSelectHistory: props.onItemSelectHistory,
      }}
    >
      {isSmall ? <DiscoverMobile /> : <DiscoverDesktop />}
    </DiscoverContext.Provider>
  );
};

export default DiscoverPage;
