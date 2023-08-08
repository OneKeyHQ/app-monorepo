import { useContext, useEffect, useRef } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';

import { DiscoverContext } from './context';

export const Observer = () => {
  const { categoryId, setCategories, setDapps } = useContext(DiscoverContext);
  const ref = useRef(categoryId);
  const locale = useAppSelector((s) => s.settings.locale);
  useEffect(() => {
    async function main(currentCategoryId: string) {
      ref.current = currentCategoryId;
      const res = await backgroundApiProxy.serviceDiscover.getHomePageData(
        categoryId,
      );
      if (ref.current === currentCategoryId) {
        setCategories(res.categories);
        setDapps(categoryId ?? 'main', res.items);
      }
    }
    main(categoryId);
    // eslint-disable-next-line
  }, [categoryId, locale]);
  return null;
};
