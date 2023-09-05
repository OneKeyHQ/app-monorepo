/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { FC } from 'react';
import { useMemo, useState } from 'react';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DiscoverContext, type IDiscoverContext } from './context';
import { CategoryDappsObserver, TabObserver } from './observer';
import { TabName } from './type';

import type {
  BannerType,
  CategoryType,
  DAppItemType,
  GroupDappsType,
} from '../type';
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
  const [tabName, setTabName] = useState<TabName>(TabName.Featured);
  const [banners, setBanners] = useState<BannerType[]>([]);
  const [groupDapps, setGroupDapps] = useState<GroupDappsType[]>([]);
  const [dapps, setRawDapps] = useState<Record<string, DAppItemType[]>>({});
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const isSmall = useIsVerticalLayout();
  if (isSmall && !Mobile) {
    Mobile = require('./Mobile').Mobile;
  } else if (!isSmall && !Desktop) {
    Desktop = require('./Desktop').Desktop;
  }

  const contextValue = useMemo<IDiscoverContext>(
    () => ({
      tabName,
      setTabName,
      banners,
      setBanners,
      groupDapps,
      setGroupDapps,
      dapps,
      setDapps: (key, items: DAppItemType[]) => {
        const data = { ...dapps, [key]: items };
        setRawDapps(data);
      },
      categories,
      setCategories,
      categoryId,
      setCategoryId,
      onItemSelect,
      onItemSelectHistory,
    }),
    [
      categoryId,
      categories,
      dapps,
      banners,
      groupDapps,
      tabName,
      onItemSelect,
      onItemSelectHistory,
    ],
  );
  return (
    <DiscoverContext.Provider value={contextValue}>
      <Box flex="1">
        {isSmall ? <Mobile /> : <Desktop />}
        <CategoryDappsObserver />
        <TabObserver />
      </Box>
    </DiscoverContext.Provider>
  );
};

export default DiscoverPage;
