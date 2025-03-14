import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

const SEARCH_ITEM_ID = 'SEARCH_ITEM_ID';
const GOOGLE_LOGO_URL = 'https://uni.onekey-asset.com/static/logo/google.png';

export interface ILocalDataType {
  bookmarkData: Array<{
    url: string;
    title: string;
    logo?: string;
  }>;
  historyData: Array<{
    url: string;
    title: string;
    logo?: string;
    titleMatch?: IFuseResultMatch;
    urlMatch?: IFuseResultMatch;
  }>;
}

export function useSearchModalData(searchValue: string) {
  const intl = useIntl();
  const { serviceDiscovery } = backgroundApiProxy;
  const [searchList, setSearchList] = useState<IDApp[]>([]);

  // Get bookmark and history data
  const { result: localData, run: refreshLocalData } =
    usePromiseResult<ILocalDataType | null>(async () => {
      const bookmarkData = await serviceDiscovery.getBookmarkData({
        generateIcon: true,
        sliceCount: 6,
      });
      const historyData = await serviceDiscovery.getHistoryData({
        generateIcon: true,
        sliceCount: 6,
        keyword: searchValue ?? undefined,
      });
      return {
        bookmarkData,
        historyData,
      };
    }, [serviceDiscovery, searchValue]);

  // Search for DApps
  const { result: searchResult } = usePromiseResult(async () => {
    const res = await serviceDiscovery.searchDApp(searchValue);
    return res;
  }, [searchValue, serviceDiscovery]);

  // Process search results
  useEffect(() => {
    void (async () => {
      if (!searchValue) {
        setSearchList([]);
        return;
      }

      const exactUrlResults =
        searchResult?.filter((item) => item.isExactUrl) || [];
      const otherResults =
        searchResult?.filter((item) => !item.isExactUrl) || [];
      setSearchList([
        ...exactUrlResults,
        {
          dappId: SEARCH_ITEM_ID,
          name: `${intl.formatMessage({
            id: ETranslations.explore_search_placeholder,
          })} "${searchValue}"`,
          url: '',
          logo: GOOGLE_LOGO_URL,
        } as IDApp,
        ...otherResults,
      ]);
    })();
  }, [searchValue, searchResult, intl]);

  // Determine what to display
  const displaySearchList = Array.isArray(searchList) && searchList.length > 0;
  const displayBookmarkList =
    (localData?.bookmarkData ?? []).length > 0 && !displaySearchList;
  const displayHistoryList = (localData?.historyData ?? []).length > 0;

  return {
    localData: localData ?? null,
    refreshLocalData,
    searchList,
    displaySearchList,
    displayBookmarkList,
    displayHistoryList,
    SEARCH_ITEM_ID,
  };
}
