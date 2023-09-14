import { useContext, useEffect, useRef } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';

import { DiscoverContext } from './context';
import { TabName } from './type';

export const CategoryDappsObserver = () => {
  const { categoryId, setDapps, setCategories, setCategoryId } =
    useContext(DiscoverContext);
  const ref = useRef(categoryId);
  const locale = useAppSelector((s) => s.settings.locale);
  useEffect(() => {
    async function main(currentCategoryId: string) {
      ref.current = currentCategoryId;
      const res = await backgroundApiProxy.serviceDiscover.getExplore({
        categoryId,
      });
      if (ref.current === currentCategoryId) {
        setCategories(res.categories);
        if (categoryId) {
          setDapps(categoryId, res.list);
        } else {
          const { id } = res.categories[0];
          if (id) {
            setCategoryId(id);
            setDapps(id, res.list);
          }
        }
      }
    }
    main(categoryId);
    // eslint-disable-next-line
  }, [categoryId, locale]);
  return null;
};

export const TabObserver = () => {
  const { setBanners, setGroupDapps, tabName } = useContext(DiscoverContext);
  useEffect(() => {
    async function main() {
      if (tabName === TabName.Featured) {
        const res = await backgroundApiProxy.serviceDiscover.getFeatured();
        if (res.banners) {
          setBanners(res.banners);
        }
        if (res.list) {
          setGroupDapps(res.list);
        }
      }
    }
    main();
    // eslint-disable-next-line
  }, [tabName]);
  return null;
};
