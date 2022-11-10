import { FC, useCallback, useEffect, useState } from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { AppStatusActiveListener } from '../../../components/AppStatusActiveListener';

import { DiscoverContext, ItemSource } from './context';
import { Desktop } from './Desktop';
import { Mobile } from './Mobile';
import { DiscoverProps } from './type';

const Updater = () => {
  const onActive = useCallback(
    () => backgroundApiProxy.serviceDiscover.fetchData(),
    [],
  );
  useEffect(() => {
    onActive();
  }, [onActive]);
  return <AppStatusActiveListener onActive={onActive} />;
};

const DiscoverPage: FC<DiscoverProps> = ({
  onItemSelect,
  onItemSelectHistory,
}) => {
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
        onItemSelect,
        onItemSelectHistory,
      }}
    >
      {isSmall ? <Mobile /> : <Desktop />}
      <Updater />
    </DiscoverContext.Provider>
  );
};

export default DiscoverPage;
