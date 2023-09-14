import { type ReactElement, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useShowBookmark } from '../hooks/useControl';

import { SectionExplore } from './TabExplore';
import { SectionFavorites } from './TabFavorites';
import { SectionFeatured } from './TabFeatured';
import { TabName } from './type';

type TabItemConfig = {
  name: TabName;
  label: string;
  component: ReactElement;
  hide?: boolean;
};

export const useTabConfig = (): TabItemConfig[] => {
  const intl = useIntl();
  const showBookmark = useShowBookmark();
  return useMemo(() => {
    const options = [
      {
        name: TabName.Featured,
        label: intl.formatMessage({ id: 'form__featured_uppercase' }),
        component: <SectionFeatured />,
        hide: !showBookmark,
      },
      {
        name: TabName.Explore,
        label: intl.formatMessage({ id: 'form__explore' }),
        component: <SectionExplore />,
        hide: !showBookmark,
      },
      {
        name: TabName.Favorites,
        label: intl.formatMessage({ id: 'title__favorites' }),
        component: <SectionFavorites />,
      },
    ];
    return options.filter((o) => !o.hide);
  }, [showBookmark, intl]);
};
