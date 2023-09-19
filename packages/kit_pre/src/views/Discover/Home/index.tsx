/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { FC } from 'react';
import { useMemo, useState } from 'react';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DiscoverContext, type IDiscoverContext } from './context';
import { Observer } from './observer';

import type { CategoryType, GroupDappsType } from '../type';
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
  const [dapps, setRawDapps] = useState<Record<string, GroupDappsType[]>>({});
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
      dapps,
      setDapps: (key, items: GroupDappsType[]) => {
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
    [categoryId, categories, dapps, onItemSelect, onItemSelectHistory],
  );
  return (
    <DiscoverContext.Provider value={contextValue}>
      <Box flex="1">
        {isSmall ? <Mobile /> : <Desktop />}
        <Observer />
      </Box>
    </DiscoverContext.Provider>
  );
};

export default DiscoverPage;
