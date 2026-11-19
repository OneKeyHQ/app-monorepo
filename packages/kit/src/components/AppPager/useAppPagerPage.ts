import { useContext } from 'react';

import { useWebCollapsiblePagerPage } from 'react-native-pager-view';

import { AppPagerPageContext } from './context';

export const useAppPagerPage = () => {
  const business = useContext(AppPagerPageContext);
  const sdk = useWebCollapsiblePagerPage();
  return {
    ...business,
    isFocused: sdk?.isFocused ?? business.isFocused,
    owner: sdk?.owner ?? null,
    content: sdk?.content ?? null,
    contentHeight: sdk?.contentHeight,
    width: sdk?.width ?? 0,
    height: sdk?.height ?? 0,
    scrollTop: sdk?.scrollTop ?? 0,
  };
};
