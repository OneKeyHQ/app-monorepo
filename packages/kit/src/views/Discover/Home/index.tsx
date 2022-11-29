/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { FC, useEffect, useState } from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DiscoverContext, ItemSource } from './context';
import { DiscoverProps } from './type';

const Updater = () => {
  useEffect(() => {
    backgroundApiProxy.serviceDiscover.fetchData();
  }, []);
  return null;
};

let Mobile: any;
let Desktop: any;

if (platformEnv.isDesktop || platformEnv.isNativeIOSPad) {
  Desktop = require('./Desktop').Desktop;
} else if (platformEnv.isNative) {
  Mobile = require('./Mobile').Mobile;
}

const DiscoverPage: FC<DiscoverProps> = ({
  onItemSelect,
  onItemSelectHistory,
}) => {
  const [categoryId, setCategoryId] = useState('');
  const isSmall = useIsVerticalLayout();
  if (isSmall && !Mobile) {
    Mobile = require('./Mobile').Mobile;
  } else if (!isSmall && !Desktop) {
    Desktop = require('./Desktop').Desktop;
  }
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
