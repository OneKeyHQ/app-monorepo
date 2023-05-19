/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import { useIsVerticalLayout } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DiscoverContext } from './context';

import type { ItemSource } from './context';
import type { DiscoverProps } from './type';

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
  useFocusEffect(
    useCallback(() => {
      backgroundApiProxy.serviceDiscover.fetchData();
      backgroundApiProxy.serviceTranslation.fetchData();
    }, []),
  );

  const [categoryId, setCategoryId] = useState('');
  const isSmall = useIsVerticalLayout();
  if (isSmall && !Mobile) {
    Mobile = require('./Mobile').Mobile;
  } else if (!isSmall && !Desktop) {
    Desktop = require('./Desktop').Desktop;
  }
  const [itemSource, setItemSource] = useState<ItemSource>('Favorites');
  const contextValue = useMemo(
    () => ({
      categoryId,
      setCategoryId,
      itemSource,
      setItemSource,
      onItemSelect,
      onItemSelectHistory,
    }),
    [categoryId, itemSource, onItemSelect, onItemSelectHistory],
  );
  return (
    <DiscoverContext.Provider value={contextValue}>
      {isSmall ? <Mobile /> : <Desktop />}
    </DiscoverContext.Provider>
  );
};

export default DiscoverPage;
