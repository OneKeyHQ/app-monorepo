import type { RefObject } from 'react';
import {
  type ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';

import { useIntl } from 'react-intl';

import type { ForwardRefHandle } from '@onekeyhq/app/src/views/NestedTabView/NestedTabView';

import { useShowBookmark } from '../hooks/useControl';

import { DiscoverContext } from './context';
import { discoverUIEventBus } from './eventBus';
import { SectionExplore } from './TabExplore';
import { SectionFavorites } from './TabFavorites';
import { SectionFeatured } from './TabFeatured';
import { TabName } from './type';

import type { CategoryType } from '../type';

type TabItemConfig = {
  name: TabName;
  label: string;
  component: ReactElement;
  hide?: boolean;
};

function toUpperCase(s: string) {
  return s.toUpperCase();
}

export const useTabConfig = (): TabItemConfig[] => {
  const intl = useIntl();
  const showBookmark = useShowBookmark();
  return useMemo(() => {
    const options = [
      {
        name: TabName.Featured,
        label: toUpperCase(
          intl.formatMessage({ id: 'form__featured_uppercase' }),
        ),
        component: <SectionFeatured />,
        hide: !showBookmark,
      },
      {
        name: TabName.Explore,
        label: toUpperCase(intl.formatMessage({ id: 'form__explore' })),
        component: <SectionExplore />,
        hide: !showBookmark,
      },
      {
        name: TabName.Favorites,
        label: toUpperCase(intl.formatMessage({ id: 'title__favorites' })),
        component: <SectionFavorites />,
      },
    ];
    return options.filter((o) => !o.hide);
  }, [showBookmark, intl]);
};

export const useOnTabChange = () => {
  const { setTabName } = useContext(DiscoverContext);
  const tabConfig = useTabConfig();
  const onTabChange = useCallback(
    (index: number) => {
      const conf = tabConfig[index];
      setTabName?.(conf.name);
    },
    [tabConfig, setTabName],
  );
  return onTabChange;
};

export const usePressTagEffect = ({
  ref,
}: {
  ref: RefObject<ForwardRefHandle>;
}) => {
  const { setCategoryId } = useContext(DiscoverContext);
  useEffect(() => {
    const fn = (item: CategoryType) => {
      if (ref.current) {
        setCategoryId(item.id);
        ref.current.setPageIndex(1);
      }
    };
    discoverUIEventBus.on('pressTag', fn);
    return () => {
      discoverUIEventBus.off('pressTag', fn);
    };
    // eslint-disable-next-line
  }, [ref]);
};
